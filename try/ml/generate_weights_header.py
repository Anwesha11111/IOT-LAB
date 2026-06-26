"""
Fallback header generator using only NumPy.
Trains a simple 2-layer MLP (5 -> 16 -> 16 -> 3) using mini-batch gradient descent,
then exports the raw weights/biases as a C header so the ESP32 can do inference
WITHOUT the TFLite runtime library.

This is a self-contained alternative to train_model.py for environments where
TensorFlow is not yet installed.  Once TF is available, use train_model.py instead
to get a proper quantized TFLite model.

Usage:
  python generate_weights_header.py

Outputs:
  model_weights.h   (in this directory AND in ../edgeguard_esp32/)
"""

import os
import numpy as np

SEED = 42
np.random.seed(SEED)

# ---------------------------------------------------------------------------
# 1. Synthetic dataset  (same distributions as train_model.py)
# ---------------------------------------------------------------------------
N = 4000

def _clip(a, lo, hi):
    return np.clip(a, lo, hi)

def make_class(hr_mu, hr_sig, spo2_mu, spo2_sig,
               temp_mu, temp_sig,
               mot_mu, mot_sig,
               tilt_mu, tilt_sig,
               hr_bimodal=False):
    if hr_bimodal:
        hr = _clip(np.concatenate([
            np.random.normal(120, 12, N//2),
            np.random.normal(48,  3,  N//2)
        ]), 45, 140)
    else:
        hr = _clip(np.random.normal(hr_mu, hr_sig, N), 45, 140)
    spo2 = _clip(np.random.normal(spo2_mu, spo2_sig, N), 80, 100)
    temp = _clip(np.random.normal(temp_mu, temp_sig, N), 35.5, 39.5)
    mot  = _clip(np.random.normal(mot_mu,  mot_sig,  N), 0.8, 5.0)
    tilt = _clip(np.random.normal(tilt_mu, tilt_sig, N), 0, 90)
    return np.column_stack([hr, spo2, temp, mot, tilt])

relaxed = make_class(65, 8,   98, 0.8, 36.3, 0.3, 0.95, 0.1,  4,  3)
normal  = make_class(80, 12,  97, 1.0, 36.7, 0.4, 1.40, 0.35, 15, 10)
stress  = make_class(0,  0,   91, 3.0, 38.2, 0.6, 2.80, 0.9,  50, 20, hr_bimodal=True)

X = np.vstack([relaxed, normal, stress]).astype(np.float32)
y = np.array([0]*N + [1]*N + [2]*N, dtype=np.int32)

# Shuffle
idx = np.random.permutation(len(X))
X, y = X[idx], y[idx]

# Train / test split
split = int(0.8 * len(X))
Xtr, Xte = X[:split], X[split:]
ytr, yte = y[:split], y[split:]

# StandardScaler
mean_ = Xtr.mean(axis=0)
std_  = Xtr.std(axis=0) + 1e-8
Xtr_s = (Xtr - mean_) / std_
Xte_s = (Xte - mean_) / std_

print(f"Dataset: {len(Xtr)} train, {len(Xte)} test")
print(f"Scaler mean: {mean_}")
print(f"Scaler std : {std_}")

# ---------------------------------------------------------------------------
# 2. Network definition  (5 -> 16 -> 16 -> 3)
# ---------------------------------------------------------------------------
def relu(x):       return np.maximum(0, x)
def softmax(x):
    e = np.exp(x - x.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)

def forward(x, params):
    W1, b1, W2, b2, W3, b3 = params
    h1 = relu(x @ W1 + b1)
    h2 = relu(h1 @ W2 + b2)
    out = softmax(h2 @ W3 + b3)
    return h1, h2, out

def cross_entropy(probs, labels):
    n = len(labels)
    return -np.log(probs[np.arange(n), labels] + 1e-12).mean()

def one_hot(y, k=3):
    oh = np.zeros((len(y), k), dtype=np.float32)
    oh[np.arange(len(y)), y] = 1.0
    return oh

# He initialisation
def he(fan_in, fan_out):
    return np.random.randn(fan_in, fan_out).astype(np.float32) * np.sqrt(2.0 / fan_in)

W1 = he(5, 16);  b1 = np.zeros((1, 16), dtype=np.float32)
W2 = he(16, 16); b2 = np.zeros((1, 16), dtype=np.float32)
W3 = he(16, 3);  b3 = np.zeros((1, 3),  dtype=np.float32)
params = [W1, b1, W2, b2, W3, b3]

# ---------------------------------------------------------------------------
# 3. Training  (mini-batch SGD with momentum)
# ---------------------------------------------------------------------------
LR     = 0.01
EPOCHS = 80
BATCH  = 64
BETA   = 0.9   # momentum

# Velocity buffers
vel = [np.zeros_like(p) for p in params]

best_val_acc = 0
best_params  = [p.copy() for p in params]

# Validation split from training set
val_split = int(0.85 * len(Xtr_s))
Xval_s, yval = Xtr_s[val_split:], ytr[val_split:]
Xfit_s, yfit = Xtr_s[:val_split], ytr[:val_split]

for epoch in range(EPOCHS):
    # Shuffle training data each epoch
    perm = np.random.permutation(len(Xfit_s))
    Xfit_s, yfit = Xfit_s[perm], yfit[perm]

    total_loss = 0.0
    n_batches  = 0

    for start in range(0, len(Xfit_s), BATCH):
        xb = Xfit_s[start:start+BATCH]
        yb = yfit[start:start+BATCH]

        W1, b1, W2, b2, W3, b3 = params
        h1, h2, probs = forward(xb, params)
        loss = cross_entropy(probs, yb)
        total_loss += loss
        n_batches  += 1

        # Backprop
        B = len(xb)
        dL_dout = (probs - one_hot(yb)) / B            # (B, 3)

        dW3 = h2.T @ dL_dout
        db3 = dL_dout.sum(axis=0, keepdims=True)

        dh2 = dL_dout @ W3.T * (h2 > 0)
        dW2 = h1.T @ dh2
        db2 = dh2.sum(axis=0, keepdims=True)

        dh1 = dh2 @ W2.T * (h1 > 0)
        dW1 = xb.T @ dh1
        db1 = dh1.sum(axis=0, keepdims=True)

        grads = [dW1, db1, dW2, db2, dW3, db3]

        # Momentum update
        for i, (p, g) in enumerate(zip(params, grads)):
            vel[i] = BETA * vel[i] + (1 - BETA) * g
            params[i] = p - LR * vel[i]

    # Validation accuracy
    _, _, val_probs = forward(Xval_s, params)
    val_acc = (np.argmax(val_probs, axis=1) == yval).mean()

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        best_params  = [p.copy() for p in params]

    if (epoch + 1) % 10 == 0:
        print(f"Epoch {epoch+1:3d}/{EPOCHS}  loss={total_loss/n_batches:.4f}  val_acc={val_acc*100:.1f}%")

params = best_params
print(f"\nBest validation accuracy: {best_val_acc*100:.2f}%")

# ---------------------------------------------------------------------------
# 4. Test evaluation
# ---------------------------------------------------------------------------
_, _, test_probs = forward(Xte_s, params)
preds = np.argmax(test_probs, axis=1)
test_acc = (preds == yte).mean()
print(f"Test accuracy: {test_acc*100:.2f}%")

labels = ["Relaxed", "Normal", "Stress"]
for c, name in enumerate(labels):
    mask = (yte == c)
    acc_c = (preds[mask] == yte[mask]).mean()
    print(f"  {name}: {acc_c*100:.1f}%")

# ---------------------------------------------------------------------------
# 5. Export C header
# ---------------------------------------------------------------------------
W1, b1, W2, b2, W3, b3 = params

def arr_to_c(arr, name):
    flat = arr.flatten().tolist()
    vals = ", ".join(f"{v:.8f}f" for v in flat)
    total = len(flat)
    return f"const float {name}[{total}] = {{{vals}}};"

def shape_comment(arr, name):
    return f"// {name}: shape {list(arr.shape)}"

header_lines = [
    "// Auto-generated by generate_weights_header.py — DO NOT EDIT",
    "// EdgeGuard lightweight MLP  (5 -> 16 -> 16 -> 3)",
    "// Classes: 0=Relaxed  1=Normal  2=Stress/Critical",
    "",
    "#pragma once",
    "#ifndef EDGEGUARD_WEIGHTS_H",
    "#define EDGEGUARD_WEIGHTS_H",
    "",
    "#include <math.h>",
    "",
    "// ---------------------------------------------------------------",
    "// StandardScaler parameters",
    "// Normalise each input before inference:",
    "//   norm[i] = (raw[i] - SCALER_MEAN[i]) / SCALER_STD[i]",
    "// Feature order: [heart_rate, spo2, body_temp, motion_mag, tilt_angle]",
    "// ---------------------------------------------------------------",
    f"const float SCALER_MEAN[5] = {{{', '.join(f'{v:.8f}f' for v in mean_)}}};",
    f"const float SCALER_STD[5]  = {{{', '.join(f'{v:.8f}f' for v in std_)}}};",
    "",
    "// ---------------------------------------------------------------",
    "// Layer weights  (row-major, i.e. W[row][col] → W[row * cols + col])",
    "// ---------------------------------------------------------------",
    shape_comment(W1, "W1"), arr_to_c(W1, "W1"),
    shape_comment(b1, "b1"), arr_to_c(b1.flatten(), "b1"),
    shape_comment(W2, "W2"), arr_to_c(W2, "W2"),
    shape_comment(b2, "b2"), arr_to_c(b2.flatten(), "b2"),
    shape_comment(W3, "W3"), arr_to_c(W3, "W3"),
    shape_comment(b3, "b3"), arr_to_c(b3.flatten(), "b3"),
    "",
    "// ---------------------------------------------------------------",
    "// Inference helper — call this from your sketch",
    "// inputs[5]: {heart_rate, spo2, body_temp, motion_mag, tilt_angle} (raw values)",
    "// returns: 0=Relaxed  1=Normal  2=Stress/Critical",
    "// ---------------------------------------------------------------",
    "inline int edgeguard_predict(const float inputs[5]) {",
    "  // Normalize",
    "  float x[5];",
    "  for (int i = 0; i < 5; i++) x[i] = (inputs[i] - SCALER_MEAN[i]) / SCALER_STD[i];",
    "",
    "  // Layer 1: Dense(16, relu)",
    "  float h1[16];",
    "  for (int j = 0; j < 16; j++) {",
    "    float acc = b1[j];",
    "    for (int i = 0; i < 5; i++) acc += x[i] * W1[i * 16 + j];",
    "    h1[j] = acc > 0.0f ? acc : 0.0f;  // ReLU",
    "  }",
    "",
    "  // Layer 2: Dense(16, relu)",
    "  float h2[16];",
    "  for (int j = 0; j < 16; j++) {",
    "    float acc = b2[j];",
    "    for (int i = 0; i < 16; i++) acc += h1[i] * W2[i * 16 + j];",
    "    h2[j] = acc > 0.0f ? acc : 0.0f;  // ReLU",
    "  }",
    "",
    "  // Layer 3: Dense(3) — argmax (no softmax needed for argmax)",
    "  float logits[3];",
    "  for (int j = 0; j < 3; j++) {",
    "    float acc = b3[j];",
    "    for (int i = 0; i < 16; i++) acc += h2[i] * W3[i * 3 + j];",
    "    logits[j] = acc;",
    "  }",
    "",
    "  // Argmax",
    "  int best = 0;",
    "  for (int j = 1; j < 3; j++) {",
    "    if (logits[j] > logits[best]) best = j;",
    "  }",
    "  return best;",
    "}",
    "",
    "#endif  // EDGEGUARD_WEIGHTS_H",
]

header_content = "\n".join(header_lines)

# Write locally
with open("model_weights.h", "w", encoding="utf-8") as f:
    f.write(header_content)

# Copy to sketch directory
sketch_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "edgeguard_esp32")
os.makedirs(sketch_dir, exist_ok=True)
sketch_path = os.path.join(sketch_dir, "model_weights.h")
with open(sketch_path, "w", encoding="utf-8") as f:
    f.write(header_content)

print(f"\n✅  C header written to: model_weights.h")
print(f"✅  C header copied to : {sketch_path}")
print("\nInclude in your sketch with:  #include \"model_weights.h\"")
print("Then call:  int cls = edgeguard_predict(inputs);")

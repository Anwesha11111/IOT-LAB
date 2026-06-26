"""
EdgeGuard ML Training Pipeline
================================
Generates synthetic physiological data, trains a lightweight neural network,
quantizes it to TFLite INT8, and exports a C-header file (model.h) that can be
compiled directly into the ESP32 firmware.

Inputs  (5 features):
  [0] heart_rate      – BPM        (float, 45 – 140)
  [1] spo2            – %          (float, 80 – 100)
  [2] body_temp       – °C         (float, 35.5 – 39.5)
  [3] motion_mag      – g          (float, 0.8 – 5.0)
  [4] tilt_angle      – degrees    (float, 0 – 90)

Output classes (3):
  0 – Relaxed
  1 – Normal
  2 – Stress / Critical

Usage:
  pip install -r requirements.txt
  python train_model.py

Outputs written to this directory:
  edgeguard_model.tflite
  model.h   (copied to ../edgeguard_esp32/model.h as well)
"""

import os
import struct
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report
import pickle

# ---------------------------------------------------------------------------
# 1.  SYNTHETIC DATASET GENERATION
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

N_PER_CLASS = 4000   # samples per class

def _clip(arr, lo, hi):
    return np.clip(arr, lo, hi)

# ---- Class 0: Relaxed ----
# Low HR, high SpO2, normal-low temp, minimal motion, low tilt
relaxed_hr    = _clip(np.random.normal(65,  8,  N_PER_CLASS), 45, 80)
relaxed_spo2  = _clip(np.random.normal(98,  0.8, N_PER_CLASS), 96, 100)
relaxed_temp  = _clip(np.random.normal(36.3, 0.3, N_PER_CLASS), 35.5, 37.0)
relaxed_mot   = _clip(np.random.normal(0.95, 0.1, N_PER_CLASS), 0.8, 1.3)
relaxed_tilt  = _clip(np.random.normal(4,   3,  N_PER_CLASS), 0, 20)
relaxed = np.column_stack([relaxed_hr, relaxed_spo2, relaxed_temp, relaxed_mot, relaxed_tilt])

# ---- Class 1: Normal / Active ----
# Mid HR, good SpO2, normal temp, moderate motion
normal_hr    = _clip(np.random.normal(80,  12,  N_PER_CLASS), 60, 105)
normal_spo2  = _clip(np.random.normal(97,  1.0, N_PER_CLASS), 94, 100)
normal_temp  = _clip(np.random.normal(36.7, 0.4, N_PER_CLASS), 36.0, 37.5)
normal_mot   = _clip(np.random.normal(1.4,  0.35, N_PER_CLASS), 0.9, 2.5)
normal_tilt  = _clip(np.random.normal(15,   10, N_PER_CLASS), 0, 45)
normal = np.column_stack([normal_hr, normal_spo2, normal_temp, normal_mot, normal_tilt])

# ---- Class 2: Stress / Critical ----
# High HR or very low, low SpO2, elevated temp, high motion or fall
stress_hr    = _clip(
    np.concatenate([
        np.random.normal(120, 12, N_PER_CLASS // 2),   # tachycardia
        np.random.normal(48,  3,  N_PER_CLASS // 2),   # bradycardia
    ]), 45, 140)
stress_spo2  = _clip(np.random.normal(91,  3,  N_PER_CLASS), 80, 95)
stress_temp  = _clip(np.random.normal(38.2, 0.6, N_PER_CLASS), 37.5, 39.5)
stress_mot   = _clip(np.random.normal(2.8,  0.9, N_PER_CLASS), 1.5, 5.0)
stress_tilt  = _clip(np.random.normal(50,   20, N_PER_CLASS), 20, 90)
stress = np.column_stack([stress_hr, stress_spo2, stress_temp, stress_mot, stress_tilt])

X = np.vstack([relaxed, normal, stress]).astype(np.float32)
y = np.array([0]*N_PER_CLASS + [1]*N_PER_CLASS + [2]*N_PER_CLASS, dtype=np.int32)

print(f"Dataset shape: X={X.shape}, y={y.shape}")
print(f"Class distribution: {np.bincount(y)}")

# ---------------------------------------------------------------------------
# 2.  PREPROCESSING
# ---------------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train).astype(np.float32)
X_test_s  = scaler.transform(X_test).astype(np.float32)

# Save scaler means/stds for embedding in firmware
scaler_mean = scaler.mean_.astype(np.float32)
scaler_std  = scaler.scale_.astype(np.float32)
print(f"\nScaler mean: {scaler_mean}")
print(f"Scaler std : {scaler_std}")

# Also save scaler as pickle for future use
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

# ---------------------------------------------------------------------------
# 3.  MODEL ARCHITECTURE
# ---------------------------------------------------------------------------
# Kept deliberately tiny: ~500 params so it fits in TFLM arena on ESP32.
inputs = tf.keras.Input(shape=(5,), name="vitals")
x = tf.keras.layers.Dense(16, activation="relu", name="dense1")(inputs)
x = tf.keras.layers.Dense(16, activation="relu", name="dense2")(x)
outputs = tf.keras.layers.Dense(3, activation="softmax", name="output")(x)

model = tf.keras.Model(inputs, outputs, name="edgeguard")
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)
model.summary()

# ---------------------------------------------------------------------------
# 4.  TRAINING
# ---------------------------------------------------------------------------
callbacks = [
    tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
    tf.keras.callbacks.ReduceLROnPlateau(patience=5, factor=0.5, verbose=1),
]

history = model.fit(
    X_train_s, y_train,
    epochs=100,
    batch_size=64,
    validation_split=0.15,
    callbacks=callbacks,
    verbose=1,
)

# ---------------------------------------------------------------------------
# 5.  EVALUATION
# ---------------------------------------------------------------------------
loss, acc = model.evaluate(X_test_s, y_test, verbose=0)
print(f"\nTest accuracy: {acc*100:.2f}%  |  Test loss: {loss:.4f}")

y_pred = np.argmax(model.predict(X_test_s, verbose=0), axis=1)
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["Relaxed", "Normal", "Stress"]))

# ---------------------------------------------------------------------------
# 6.  TFLITE CONVERSION  (INT8 post-training quantization)
# ---------------------------------------------------------------------------
def representative_dataset():
    """Feed a sample of training data as the calibration set."""
    for i in range(0, min(500, len(X_train_s)), 1):
        yield [X_train_s[i:i+1]]

converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.representative_dataset = representative_dataset
converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
converter.inference_input_type  = tf.float32   # keep float I/O for simplicity on MCU
converter.inference_output_type = tf.float32

tflite_model = converter.convert()

tflite_path = "edgeguard_model.tflite"
with open(tflite_path, "wb") as f:
    f.write(tflite_model)

size_kb = len(tflite_model) / 1024
print(f"\nTFLite model saved: {tflite_path}  ({size_kb:.1f} KB)")

# ---------------------------------------------------------------------------
# 7.  EXPORT C HEADER  (model.h)
# ---------------------------------------------------------------------------
def tflite_to_c_array(tflite_bytes: bytes, var_name: str = "g_model") -> str:
    """Convert a TFLite flatbuffer into a C unsigned char array."""
    hex_array = ", ".join(f"0x{b:02x}" for b in tflite_bytes)
    length = len(tflite_bytes)

    # Format as 12 bytes per line for readability
    chunks = [tflite_bytes[i:i+12] for i in range(0, length, 12)]
    rows   = [", ".join(f"0x{b:02x}" for b in chunk) for chunk in chunks]
    hex_body = ",\n  ".join(rows)

    lines = [
        "// Auto-generated by train_model.py — DO NOT EDIT",
        "// Model: EdgeGuard Neural Network (Relaxed / Normal / Stress)",
        f"// TFLite model size: {length} bytes  ({size_kb:.1f} KB)",
        "",
        "#pragma once",
        "#ifndef EDGEGUARD_MODEL_H",
        "#define EDGEGUARD_MODEL_H",
        "",
        "#include <stdint.h>",
        "",
        "// ---------------------------------------------------------------",
        "// Scaler parameters (StandardScaler fit on training data)",
        "// Apply before feeding into the model:",
        "//   norm_val = (raw_val - mean) / std_dev",
        "// ---------------------------------------------------------------",
        f"// Feature order: [heart_rate, spo2, body_temp, motion_mag, tilt_angle]",
        f"const float SCALER_MEAN[5] = {{{', '.join(f'{v:.6f}f' for v in scaler_mean)}}};",
        f"const float SCALER_STD[5]  = {{{', '.join(f'{v:.6f}f' for v in scaler_std)}}};",
        "",
        "// ---------------------------------------------------------------",
        "// TFLite flatbuffer",
        "// ---------------------------------------------------------------",
        f"const unsigned int g_model_len = {length};",
        f"alignas(8) const unsigned char {var_name}[] = {{",
        f"  {hex_body}",
        "};",
        "",
        "// ---------------------------------------------------------------",
        "// Output label map",
        "// ---------------------------------------------------------------",
        "// Output index 0 → Relaxed",
        "// Output index 1 → Normal",
        "// Output index 2 → Stress / Critical",
        "",
        "#endif  // EDGEGUARD_MODEL_H",
    ]
    return "\n".join(lines)

header_content = tflite_to_c_array(tflite_model)

# Write to ml/ directory
header_local = "model.h"
with open(header_local, "w") as f:
    f.write(header_content)

# Also copy directly to the sketch directory so the .ino can #include it
sketch_dir   = os.path.join(os.path.dirname(__file__), "..", "edgeguard_esp32")
header_sketch = os.path.join(sketch_dir, "model.h")
os.makedirs(sketch_dir, exist_ok=True)
with open(header_sketch, "w") as f:
    f.write(header_content)

print(f"\nC header written to: {header_local}")
print(f"C header copied to : {header_sketch}")
print("\n✅  All done! Flash your ESP32 after rebuilding the sketch.")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import tensorflow as tf
import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image

app = FastAPI(title="Realtime Face Analysis Backend")

# Load model gender
gender_model = tf.keras.models.load_model("models/gender_classification_CNN.keras")
# Load face detector
face_model = cv2.CascadeClassifier("models/haarcascade_frontalface_default.xml")

# TODO: load emotion model khi có
emotion_model = tf.keras.models.load_model("models/detection_emotion.h5")

# Utility: decode base64 frame to OpenCV BGR image
def decode_frame(data: str):
    img_bytes = base64.b64decode(data)
    img = Image.open(BytesIO(img_bytes)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

# Preprocess image for model: resize to 32x32, normalize
def preprocess(img: np.ndarray):
    img_resized = cv2.resize(img, (32, 32))
    img_norm = img_resized / 255.0
    return np.expand_dims(img_norm, axis=0)

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            frame = decode_frame(data)

            # Detect faces
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_model.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)

            results = []
            for (x, y, w, h) in faces:
                face_img = frame[y:y+h, x:x+w]
                x_input = preprocess(face_img)
                pred = gender_model.predict(x_input)
                print(pred)
                gender = "male" if pred[0][0] > 0.4 else "female"

                # Append kết quả từng khuôn mặt
                results.append({
                    "box": [int(x), int(y), int(w), int(h)],
                    "conf": float(pred[0][0]), 
                    "gender": gender,
                    "emotion": None  # TODO: Cảm xúc sau
                })
                print(results)

            await ws.send_json({"faces": results})
    except WebSocketDisconnect:
        print("Client disconnected")


@app.get("/health")
async def health_check():
    return {"status": "ok"}

import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
import tensorflow as tf
import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image
from ultralytics import YOLO

app = FastAPI(title="Realtime Face Analysis Backend")

# ----- Load models -----
gender_model  = tf.keras.models.load_model("models/gender_classification_CNN.keras")
emotion_model = tf.keras.models.load_model("models/detection_emotion.h5")
yolo_model    = YOLO('models/best.pt')

# ----- Utility -----
def decode_frame(data: str):
    """
    Nhận vào string base64, có thể kèm header 'data:...;base64,'
    Trả về OpenCV BGR image.
    """
    # nếu có header thì chỉ lấy phần sau dấu comma
    if ',' in data:
        _, data = data.split(',', 1)
    try:
        img_bytes = base64.b64decode(data)
    except Exception as e:
        raise ValueError(f"Invalid base64 data: {e}")
    img = Image.open(BytesIO(img_bytes)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

def preprocess_cnn(img: np.ndarray, size=(32,32)):
    img = cv2.resize(img, size) / 255.0
    return np.expand_dims(img, axis=0)

def run_models(frame: np.ndarray):
    """
    Chạy face detection + gender + emotion trên 1 frame.
    Trả về list kết quả.
    """
    results = []
    detections = yolo_model.predict(frame, conf=0.5, verbose=False)[0]

    for box in detections.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        # kiểm tra trong khung hình
        if x1 < 0 or y1 < 0 or x2 > frame.shape[1] or y2 > frame.shape[0]:
            continue
        face = frame[y1:y2, x1:x2]

        # ==== Gender ====
        gm = gender_model.predict(preprocess_cnn(face), verbose=0)[0][0]
        gender = "male" if gm > 0.4 else "female"

        # ==== Emotion ====
        gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        em_in = np.expand_dims(cv2.resize(gray, (48,48)) / 255.0, axis=(0,3))
        emo_pred = emotion_model.predict(em_in, verbose=0)[0]
        idx = int(np.argmax(emo_pred))
        labels = ['Angry','Disgust','Fear','Happy','Neutral','Sad','Surprise']
        emotion = labels[idx] if idx < len(labels) else "Unknown"
        emo_conf = float(emo_pred[idx]) if idx < len(emo_pred) else 0.0

        results.append({
            "box": [x1, y1, x2-x1, y2-y1],
            "gender": gender,
            "conf": float(gm),
            "emotion": emotion,
            "emotion_conf": emo_conf
        })
    return results

# queue và map ws->latest_result
frame_queue    = asyncio.Queue()
latest_results = {}

# Worker bất đồng bộ
async def inference_worker():
    while True:
        ws, data = await frame_queue.get()
        try:
            frame = decode_frame(data)
        except Exception as e:
            print(f"[Worker] decode error: {e}")
            continue

        # chạy blocking trong threadpool
        try:
            res = await run_in_threadpool(run_models, frame)
            latest_results[ws] = res
            # gửi ngay kết quả mới nhất
            await ws.send_json({"faces": res})
        except Exception as e:
            print(f"[Worker] inference error: {e}")

@app.on_event("startup")
async def on_startup():
    # khởi worker khi start app
    asyncio.create_task(inference_worker())

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            # đẩy frame vào queue, worker sẽ xử lý
            await frame_queue.put((ws, data))

            # nếu đã có kết quả cũ, gửi luôn để giảm giật
            if ws in latest_results:
                await ws.send_json({"faces": latest_results[ws]})
    except WebSocketDisconnect:
        latest_results.pop(ws, None)
        print("Client disconnected")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { connectSocket, sendFrame } from "../ws";

const videoConstraints = { width: 500, height: 500, facingMode: "user" };

export default function CameraStream() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  

  const [gender, setGender] = useState("");
  const [emotion, setEmotion] = useState("");
  const [conf, setConf] = useState("");
  const [emotion_conf, setEmotionconf] = useState("");
  const [faces, setFaces] = useState([]);
  const [camOn, setCamOn] = useState(true);
  const [inputMode, setInputMode] = useState("camera");
  const [imgSrc, setImgSrc] = useState(null);
  const fileInputRef = useRef();

  // 1. Kết nối WS và nhận data
  useEffect(() => {
    connectSocket((data) => {
      setFaces(data.faces);
      if (data.faces.length > 0) {
        const first = data.faces[0];
        // gender gửi về là string, emotion có thể null
        console.log("Gender and Emotion: " + first.gender, first.emotion);
        setGender(first.gender || "");
        setEmotion(first.emotion || "");
        setConf(first.conf || "");
        setEmotionconf(first.emotion_conf || "");
      } else {
        setGender("");
        setEmotion("");
        setConf("");
        setEmotionconf("");
      }
    });
  }, []);

  // 2. Gửi frame lên server
  useEffect(() => {
    if (!camOn || inputMode !== "camera") return;
    const id = setInterval(() => {
      const img = webcamRef.current?.getScreenshot({ quality: 0.6 });
      if (img) sendFrame(img);
    }, 500);
    return () => clearInterval(id);
  }, [camOn, inputMode]);

  // 3. Vẽ khung lên canvas khi faces thay đổi
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faces.forEach(({ box: [x, y, w, h] }) => {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "limegreen";
      ctx.strokeRect(x, y, w, h);
    });
  }, [faces]);

  const toggleCam = () => setCamOn((on) => !on);

  // Upload từ file local
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImgSrc(reader.result);
      sendFrame(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload từ URL
  const handleURLSubmit = async (e) => {
    e.preventDefault();
    const url = e.target.url.value;
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImgSrc(reader.result);
        sendFrame(reader.result);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Error loading image from URL:", err);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      {/* Chọn chế độ */}
      <div className="flex gap-4">
        <button
          onClick={() => setInputMode("camera")}
          className={`px-3 py-1 rounded ${
            inputMode === "camera" ? "bg-blue-600 text-white" : "bg-gray-300"
          }`}
        >
          Camera
        </button>
        <button
          onClick={() => setInputMode("upload")}
          className={`px-3 py-1 rounded ${
            inputMode === "upload" ? "bg-blue-600 text-white" : "bg-gray-300"
          }`}
        >
          Ảnh tĩnh
        </button>
      </div>

      {inputMode === "camera" && (
        <div className="grid grid-cols-2 gap-4 w-full items-center m-4">
          {/* Thông tin */}
          <div className="flex flex-col items-center">
            <button
              onClick={toggleCam}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {camOn ? "Tắt Camera" : "Mở Camera"}
            </button>
            <div className="text-lg font-semibold">Giới tính: {gender}</div>
            <div className="text-lg font-semibold">Cảm xúc: {emotion}</div>
            <div className="text-lg font-semibold">
              Gender Confidence: {conf}
            </div>
            <div className="text-lg font-semibold">
              Emotion Confidence: {emotion_conf}
            </div>
          </div>

          {/* Video + Canvas */}
          <div className="relative w-[500px] h-[500px] border-2 rounded-lg overflow-hidden">
            {camOn ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="absolute top-0 left-0 w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={500}
                  className="absolute top-0 left-0 pointer-events-none"
                />
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-gray-100">
                Camera đang tắt
              </div>
            )}
          </div>
        </div>
      )}

      {inputMode === "upload" && (
        <div className="flex flex-col items-center gap-4">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="mb-2"
          />
          <form onSubmit={handleURLSubmit} className="flex gap-2 mb-2">
            <input
              name="url"
              type="text"
              placeholder="Nhập URL ảnh"
              className="border px-2 py-1 w-64 rounded"
            />
            <button
              type="submit"
              className="bg-green-500 text-white px-3 rounded"
            >
              Gửi
            </button>
          </form>

          {imgSrc && (
            <div className="grid grid-cols-2 gap-4 w-full items-center m-4">
              {/* Thông tin */}
              <div className="flex flex-col items-center">
                <div className="text-lg font-semibold">Giới tính: {gender}</div>
                <div className="text-lg font-semibold">Cảm xúc: {emotion}</div>
                <div className="text-lg font-semibold">
                  Gender Confidence: {conf}
                </div>
                <div className="text-lg font-semibold">
                  Emotion Confidence: {emotion_conf}
                </div>
              </div>

              <img
                src={imgSrc}
                alt="Uploaded"
                className="relative border-2 overflow-hidden w-[320px] rounded-lg shadow-lg"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
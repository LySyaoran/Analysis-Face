import React from "react";
import CameraStream from "./components/CameraStream";

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h1 className="text-2xl font-bold mb-4 text-center">
          Nhận diện và phân tích khuôn mặt
        </h1>
        <CameraStream />
      </div>
    </div>
  );
}

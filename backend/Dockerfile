FROM python:3.9-slim

# Cài đặt các gói phụ thuộc
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Sao chép tất cả file dưới /backend vào thư mục /app container
COPY . /app
WORKDIR /app

# Expose cổng mà ứng dụng sẽ chạy
EXPOSE 8000

# Lệnh khởi động ứng dụng
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

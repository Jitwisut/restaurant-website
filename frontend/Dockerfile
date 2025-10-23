# ใช้ Node.js เวอร์ชัน LTS (เลือก 20-alpine เพื่อลดขนาด image)
FROM node:20-alpine

# ตั้งโฟลเดอร์ทำงานใน container
WORKDIR /app

# คัดลอกไฟล์ package
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install 

# คัดลอก source code ทั้งหมดเข้าไปใน container
COPY . .

# Expose port 3000
EXPOSE 3000

# รัน production server
CMD ["npm","run","dev"]

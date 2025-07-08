# ---- Dockerfile ----
FROM oven/bun:1

WORKDIR /app

# 1) คัดลอกเฉพาะไฟล์ที่ใช้คำนวณ layer-cache
#    (ใส่ * ไว้ เผื่อบางคนยังไม่มี bun.lockb ก็ไม่ error)
COPY package.json bun.lockb* ./

# 2) ติดตั้ง dependency เฉพาะ production
RUN bun install --production

# 3) คัดลอกซอร์สที่เหลือทีหลัง
COPY . .

# 4) กำหนด/เผยพอร์ต 8000 ชัด ๆ
ENV PORT=8000
EXPOSE 8000

CMD bun run src/index.ts
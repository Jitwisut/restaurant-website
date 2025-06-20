'use client'
import React, { useState } from 'react'
import QRCode from 'qrcode'

export default function QRCodeGeneratorFrontend() {
  const [qrData, setQrData] = useState('')
  const [imageUrl, setImageUrl] = useState(null)

  const handleGenerate = async () => {
    const path = `/table/${Math.floor(Math.random() * 1000000).toString(16)}`
    setQrData(path)

    const dataUrl = await QRCode.toDataURL(`https://localhost.com${path}`)
    setImageUrl(dataUrl)
  }

  return (
    <div className="p-6">
      <button
        onClick={handleGenerate}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        สร้าง QR Code
      </button>

      {imageUrl && (
        <div className="mt-4">
          <img src={imageUrl} alt="QR Code" className="w-48 h-48" />
          <p className="mt-2 text-sm text-gray-500">จะลิงก์ไปที่: {qrData}</p>
        </div>
      )}
    </div>
  )
} 
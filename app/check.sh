#!/bin/bash

echo "กำลังเปิดฐานข้อมูลและแสดงข้อมูลจากตาราง tables"

sqlite3 restaurant.sqlite "SELECT * FROM tables;"
sqlite3 restaurant.sqlite
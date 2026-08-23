import os
from PIL import Image, ImageDraw, ImageFont

img = Image.new('RGB', (320, 180), color='#090d16')
draw = ImageDraw.Draw(img)

# Outer border
draw.rectangle([4, 4, 315, 175], outline='#3b82f6', width=4)

# Draw target circle icon
draw.ellipse([40, 45, 130, 135], outline='#3b82f6', width=6)
draw.ellipse([55, 60, 115, 120], fill='#ef4444', outline='#ffffff', width=3)
draw.ellipse([75, 80, 95, 100], fill='#ffffff')

# Text
draw.text((150, 60), "TARGET", fill="#38bdf8")
draw.text((150, 85), "RANGE", fill="#f8fafc")
draw.text((150, 110), "TV", fill="#f59e0b")

os.makedirs('/home/ubuntu/Github/target-range-tv/android-tv-app/res/drawable', exist_ok=True)
img.save('/home/ubuntu/Github/target-range-tv/android-tv-app/res/drawable/banner.png')
print("Banner created successfully!")

import os
from PIL import Image, ImageDraw

# App Icon (512x512)
img = Image.new('RGBA', (512, 512), color=(15, 23, 42, 255))
draw = ImageDraw.Draw(img)

# Outer circle
draw.ellipse([30, 30, 482, 482], outline='#38bdf8', width=16)

# Crosshairs
draw.line([256, 40, 256, 180], fill='#38bdf8', width=16)
draw.line([256, 332, 256, 472], fill='#38bdf8', width=16)
draw.line([40, 256, 180, 256], fill='#38bdf8', width=16)
draw.line([332, 256, 472, 256], fill='#38bdf8', width=16)

# Center Target Red Dot
draw.ellipse([200, 200, 312, 312], fill='#ef4444', outline='#ffffff', width=8)

os.makedirs('/home/ubuntu/Github/target-range-tv/android-controller-app/res/drawable', exist_ok=True)
img.save('/home/ubuntu/Github/target-range-tv/android-controller-app/res/drawable/icon.png')
print("Controller icon created!")

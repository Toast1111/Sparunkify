"""Encode actual renderer captures. Requires Pillow; no artwork downloads."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent.parent
out=root/'docs'/'media';out.mkdir(parents=True,exist_ok=True)
font_path=next((str(p) for p in [Path('C:/Windows/Fonts/arialbd.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')] if p.exists()),None)
font=ImageFont.truetype(font_path,21) if font_path else ImageFont.load_default()
small=ImageFont.truetype(font_path,12) if font_path else ImageFont.load_default()
for name,title,subtitle in [('before','Yucky before','Early point light / washed colors'),('after','Delicious after','Soft reflections / preserved contrast')]:
    frames=[]
    for source in sorted((root/'artifacts'/'demo-frames'/name).glob('*.png')):
        frame=Image.new('RGB',(480,540),'#181818');frame.paste(Image.open(source).convert('RGB'),(0,60))
        draw=ImageDraw.Draw(frame);draw.text((16,9),title,font=font,fill='#eeeeee');draw.text((16,36),subtitle,font=small,fill='#bbbbbb');frames.append(frame)
    if len(frames)!=60:raise RuntimeError('Run render-demos.cjs first')
    # A fixed palette prevents color pumping between GIF frames.
    samples=Image.new('RGB',(480,540*6))
    for index in range(6):samples.paste(frames[index*10],(0,index*540))
    palette=samples.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    encoded=[frame.quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG) for frame in frames]
    encoded[0].save(out/(name+'.gif'),save_all=True,append_images=encoded[1:],duration=80,loop=0,optimize=True,disposal=1)
    print(name, (out/(name+'.gif')).stat().st_size,'bytes')

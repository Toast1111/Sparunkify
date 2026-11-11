"""Offscreen GPU regression check. Optional QA dependencies: ModernGL, NumPy, Pillow."""
import base64
import json
import random
import re
import subprocess
import sys
from pathlib import Path

if len(sys.argv)>1:
    sys.path.insert(0,sys.argv[1])
import moderngl
import numpy as np
from PIL import Image,ImageDraw,ImageFont

root=Path(__file__).resolve().parent.parent
output=root/'artifacts'/'environment-qa'
output.mkdir(parents=True,exist_ok=True)
size=640
art=Image.new('RGBA',(size,size),(26,26,26,255))
draw=ImageDraw.Draw(art)
# An original grayscale test scene: fine, high-contrast details and broad gradients.
draw.polygon([(0,0),(640,0),(474,170),(164,170)],fill=(155,155,155))
draw.polygon([(0,0),(164,170),(164,470),(0,640)],fill=(210,210,210))
draw.polygon([(640,0),(474,170),(474,470),(640,640)],fill=(76,76,76))
draw.polygon([(0,640),(164,470),(474,470),(640,640)],fill=(180,180,180))
rng=random.Random(12)
for _ in range(550):
    x,y=rng.randint(176,462),rng.randint(175,466)
    radius=rng.randint(2,7);value=rng.randint(95,230)
    draw.polygon([(x,y-radius),(x-radius,y+radius),(x+radius,y+radius//2)],fill=(value,value,value))
font_path=next((str(p) for p in [Path('C:/Windows/Fonts/arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists()),None)
font=ImageFont.truetype(font_path,28) if font_path else ImageFont.load_default()
label_font=ImageFont.truetype(font_path,18) if font_path else ImageFont.load_default()
draw.text((170,42),'LIGHTING CHECK',fill=(15,15,15),font=font)
draw.text((205,580),'KEEP THE DETAIL',fill=(25,25,25),font=label_font)
map_size=512
sample=art.resize((map_size,map_size),Image.Resampling.LANCZOS)
node="""
const fs=require('node:fs'),vm=require('node:vm'),box={};
vm.runInNewContext(fs.readFileSync('engine.js','utf8'),box);
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const maps=box.Sparunkify.deriveMaps(Buffer.from(input.data,'base64'),input.size,input.size);
process.stdout.write(JSON.stringify({normal:Buffer.from(maps.normal).toString('base64'),material:Buffer.from(maps.material).toString('base64')}));
"""
result=subprocess.run(['node','-e',node],cwd=root,input=json.dumps({'data':base64.b64encode(sample.tobytes()).decode(),'size':map_size}),text=True,capture_output=True,check=True)
maps=json.loads(result.stdout)
ctx=moderngl.create_context(standalone=True)
quad=ctx.buffer(np.array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1],dtype='f4').tobytes())
textures=[]
for unit,im in enumerate([art,*[Image.frombytes('RGBA',(map_size,map_size),base64.b64decode(maps[key])) for key in ['normal','material']]]):
    texture=ctx.texture(im.size,4,im.transpose(Image.Transpose.FLIP_TOP_BOTTOM).tobytes())
    texture.filter=(moderngl.LINEAR,moderngl.LINEAR)
    texture.repeat_x=texture.repeat_y=False
    texture.use(unit);textures.append(texture)
frame=ctx.simple_framebuffer((size,size),components=4);frame.use()
def compile_file(path):
    source=path.read_text(encoding='utf-8')
    vertex=re.search(r'const vertex=`(.*?)`;',source,re.S).group(1)
    fragment=re.search(r'const fragment=`(.*?)`;',source,re.S).group(1)
    program=ctx.program(vertex_shader='#version 100\n'+vertex,fragment_shader='#version 100\n'+fragment)
    for unit,name in enumerate(['art','normals','material']):program[name].value=unit
    return program,ctx.simple_vertex_array(program,quad,'position')
before=compile_file(root/'tests'/'fixtures'/'engine-v0.1.7.js')
after=compile_file(root/'engine.js')
before_tilt=compile_file(root/'tests'/'fixtures'/'engine-v0.1.8.js')
before_tones=compile_file(root/'tests'/'fixtures'/'engine-v0.1.9.js')
defaults=dict(pointer=(0.,0.),time=0.,depth=1.,roughness=1.,shine=1.,sparkle=0.,foil=0.,original=0.,showDisplacement=0.,displacementLimit=2/size)
def render(pair,**overrides):
    program,vao=pair
    for key,value in (defaults|overrides).items():program[key].value=value
    vao.render(moderngl.TRIANGLES)
    return Image.frombytes('RGBA',(size,size),frame.read(components=4)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
source=render(after,original=1.)
old=render(before)
new=render(after)
later=render(after,time=4.)
sharp=render(after,roughness=0.)
flat_relief=render(after,depth=0.)
tilted=render(after,pointer=(.8,-.6))
off=render(after,depth=0.,shine=0.,sparkle=0.)
as_array=lambda im:np.asarray(im).astype('f4')[:,:,:3]
base=as_array(source)
old_diff=np.abs(as_array(old)-base)
new_diff=np.abs(as_array(new)-base)
assert np.max(np.abs(base-as_array(art)))<=1,'Original pixels changed'
assert np.max(np.abs(as_array(off)-base))<=1,'Turning effects off must restore the image'
# Signed lighting may be neutral at some angles; inspect both tilt directions.
coverage_diff=np.maximum.reduce([new_diff,*[np.abs(as_array(render(after,pointer=p))-base) for p in [(-.5,0.),(.5,0.),(0.,-.5),(0.,.5)]]])
assert np.mean(coverage_diff.max(axis=2)>20)>.1,'Maximum roughness must still give a visible finish when tilted'
assert max(np.abs(as_array(new)-as_array(render(after,time=t))).mean() for t in [4.,8.,12.,16.,20.])>5,'Environment rotation must visibly change reflections over its cycle'
assert np.abs(as_array(new)-as_array(sharp)).mean()>5,'Roughness must visibly change reflections'
assert np.abs(as_array(new)-as_array(flat_relief)).mean()>3,'Relief must change surface lighting, not just overall brightness'
assert np.abs(as_array(new)-as_array(tilted)).mean()>3,'Cursor tilt must change environment reflections'
# Test ordinary cursor travel with automatic animation and sparkle out of the
# comparison: the default finish must respond to both axes without maxing sliders.
tilt_metrics={}
tilt_frames=[]
for roughness in [.38,1.]:
    settings=dict(depth=.48,roughness=roughness,shine=.65,sparkle=0.,foil=1.)
    for axis,negative,positive in [('horizontal',(-.5,0.),(.5,0.)),('vertical',(0.,-.5),(0.,.5))]:
        left=render(after,**settings,pointer=negative)
        right=render(after,**settings,pointer=positive)
        previous_left=render(before_tilt,**settings,pointer=negative)
        previous_right=render(before_tilt,**settings,pointer=positive)
        response=float(np.abs(as_array(left)-as_array(right)).mean())
        previous=float(np.abs(as_array(previous_left)-as_array(previous_right)).mean())
        neutral=settings|{'foil':0.}
        neutral_left=render(after,**neutral,pointer=negative)
        neutral_right=render(after,**neutral,pointer=positive)
        neutral_response=float(np.abs(as_array(neutral_left)-as_array(neutral_right)).mean())
        tilt_metrics[f'{axis}_roughness_{roughness}']={'before':round(previous,2),'after':round(response,2),'without_foil':round(neutral_response,2)}
        assert response>8 and response>previous*1.7, f'Tilt too subtle: {tilt_metrics}'
        assert neutral_response>5, f'Tilt must change lighting even without holographic color: {tilt_metrics}'
        if roughness==.38:tilt_frames.extend([(f'Default / {axis} -',left),(f'Default / {axis} +',right)])
# Keep numeric output bounded for the old saved settings and both extreme pointer positions.
for pointer in [(-1.,-1.),(1.,1.)]:
    image=render(after,pointer=pointer,foil=1.,sparkle=1.)
    assert np.asarray(image)[:,:,3].min()==255
# A uniform material must receive uniform distant lighting at every image position.
# This catches the old point lamp even when its hotspot is made very large/soft.
flat_textures=[]
for unit,pixel in enumerate([(95,95,95,255),(127,127,255,255),(128,110,150,255)]):
    texture=ctx.texture((1,1),4,bytes(pixel));texture.use(unit);flat_textures.append(texture)
for pointer in [(0.,0.),(-1.,-1.),(1.,1.)]:
    for roughness in [0.,1.]:
        flat=as_array(render(after,pointer=pointer,roughness=roughness))
        assert np.ptp(flat,axis=(0,1)).max()<=1,'A flat material must not have a screen-space hotspot'
for unit,texture in enumerate(textures):texture.use(unit)
# Isolate the light blend on a flat ink chart, including black, saturated color,
# near-white and white. A white screen overlay fails both black and saturation.
swatches=[(0,0,0),(20,20,20),(128,128,128),(220,35,55),(30,140,225),(110,35,200),(240,240,240),(255,255,255)]
chart=Image.new('RGBA',(size,size))
chart_draw=ImageDraw.Draw(chart)
for i,swatch in enumerate(swatches):chart_draw.rectangle((i*80,0,(i+1)*80-1,size-1),fill=(*swatch,255))
chart_texture=ctx.texture(chart.size,4,chart.tobytes());chart_texture.use(0)
flat_textures[1].use(1);flat_textures[2].use(2)
chart_frames=[]
for pointer in [(-.5,0.),(.5,0.),(0.,-.5),(0.,.5)]:
    im=render(after,pointer=pointer)
    values=as_array(im)[size//2,[40+i*80 for i in range(8)]]
    assert values[0].max()<=1,'Reflections must not turn black ink gray'
    assert values[1].max()<48,'Dark ink must not acquire a white veil'
    for i in [3,4,5]:
        expected=np.array(swatches[i],dtype='f4');expected/=expected.max()
        actual=values[i]/max(values[i].max(),1)
        assert np.abs(expected-actual).max()<.015,'Neutral lighting must preserve saturated ink ratios'
    chart_frames.append((float(values[2].mean()),im))
chart_frames.sort(key=lambda entry:entry[0])
assert chart_frames[0][0]<128*.92,'A dark environment must visibly shade the artwork even at maximum roughness'
assert chart_frames[-1][0]>128*1.05,'A bright environment must still light the artwork'
chart_old=render(before_tones,pointer=(.5,0.))
color_sheet=Image.new('RGB',(size*4,size+42),'#17121b')
for i,(title,im) in enumerate([('Original ink',chart),('Previous / white veil',chart_old),('Updated / shade',chart_frames[0][1]),('Updated / reflection',chart_frames[-1][1])]):
    color_sheet.paste(im.convert('RGB'),(i*size,42))
    ImageDraw.Draw(color_sheet).text((i*size+16,12),title,font=label_font,fill='#efdaea')
color_sheet.save(output/'ink-comparison.png')
for unit,texture in enumerate(textures):texture.use(unit)
sheet=Image.new('RGB',(size*4,size+42),'#17121b')
for i,(title,im) in enumerate([('Original',source),('Previous / point light',old),('Indirect / max settings',new),('Indirect / rotated environment',later)]):
    sheet.paste(im.convert('RGB'),(i*size,42))
    ImageDraw.Draw(sheet).text((i*size+16,12),title,font=label_font,fill='#efdaea')
sheet.save(output/'comparison.png')
for i,(title,im) in enumerate(tilt_frames):
    sheet.paste(im.convert('RGB'),(i*size,42))
    ImageDraw.Draw(sheet).rectangle((i*size,0,(i+1)*size,41),fill='#17121b')
    ImageDraw.Draw(sheet).text((i*size+16,12),title,font=label_font,fill='#efdaea')
sheet.save(output/'tilt-comparison.png')
print(json.dumps({'tilt_response':tilt_metrics}))
print(json.dumps({'gpu':ctx.info['GL_RENDERER'],'old_mean_change':round(float(old_diff.mean()),2),'new_mean_change':round(float(new_diff.mean()),2),'visible_coverage_percent':round(float(np.mean(coverage_diff.max(axis=2)>20))*100,1),'checks':'source preservation, intensity, animation, roughness, full coverage, no hotspot, black ink, saturation and signed lighting passed','comparison':str(output/'comparison.png')}))

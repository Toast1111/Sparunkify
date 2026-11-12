"""Optimize a README recording without modifying the original. Requires Pillow."""
import argparse
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path, help='Path to the original GIF recording')
parser.add_argument('--output', type=Path, default=root / 'docs/media/maxwell.gif')
args = parser.parse_args()
source, destination = args.source.resolve(), args.output.resolve()
if source == destination:
    parser.error('Choose an output path different from the original recording.')
with Image.open(source) as original:
    size = (640, round(original.height * 640 / original.width))
    count, loop = original.n_frames, original.info.get('loop', 0)
    samples = Image.new('RGB', (320 * 3, round(size[1] / 2) * 2))
    for i in range(6):
        original.seek(i * (count - 1) // 5)
        sample = original.convert('RGB').resize((320, round(size[1] / 2)), Image.Resampling.LANCZOS)
        samples.paste(sample, ((i % 3) * sample.width, (i // 3) * sample.height))
    palette = samples.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    frames, durations = [], []
    original.seek(0)
    for i in range(count):
        original.seek(i)
        if i % 2 == 0:
            frame = original.convert('RGB').resize(size, Image.Resampling.LANCZOS)
            frames.append(frame.quantize(palette=palette, dither=Image.Dither.NONE))
            durations.append(0)
        durations[-1] += original.info.get('duration', 40)
    destination.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(destination, save_all=True, append_images=frames[1:], duration=durations,
                   loop=loop, optimize=True, disposal=1)
    print(f'{destination.name}: {destination.stat().st_size:,} bytes; {size}; {sum(durations)/1000:.2f}s')

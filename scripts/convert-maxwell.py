"""Convert the supplied static FBX mesh to the small, dependency-free viewer format.

Run from the repository root: python scripts/convert-maxwell.py
Only Python's standard library is required. Runtime textures are kept in assets/maxwell/.
"""
import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/maxwell/source/maxwell.fbx'
data = SOURCE.read_bytes()
version = struct.unpack_from('<I', data, 23)[0]
assert 7000 <= version < 7500, 'Expected a binary FBX 7.0–7.4 file'
offset = 27


def prop():
    global offset
    kind = chr(data[offset])
    offset += 1
    if kind in 'Y C I F D L'.split():
        fmt = {'Y': 'h', 'C': '?', 'I': 'i', 'F': 'f', 'D': 'd', 'L': 'q'}[kind]
        value = struct.unpack_from('<' + fmt, data, offset)[0]
        offset += struct.calcsize(fmt)
        return value
    if kind in 'SR':
        length = struct.unpack_from('<I', data, offset)[0]
        offset += 4
        value = data[offset:offset + length]
        offset += length
        return value.decode('utf8', errors='replace') if kind == 'S' else value.hex()
    if kind in 'fdlibc':
        length, encoding, size = struct.unpack_from('<III', data, offset)
        offset += 12
        raw = data[offset:offset + size]
        offset += size
        if encoding:
            raw = zlib.decompress(raw)
        fmt = {'f': 'f', 'd': 'd', 'l': 'q', 'i': 'i', 'b': '?', 'c': 'b'}[kind]
        return list(struct.unpack('<' + str(length) + fmt, raw))
    raise ValueError('Unsupported FBX property: ' + kind)


def node():
    global offset
    end, count, _, length = struct.unpack_from('<IIIB', data, offset)
    offset += 13
    if not end:
        return None
    name = data[offset:offset + length].decode()
    offset += length
    values = [prop() for _ in range(count)]
    children = []
    while offset < end:
        child = node()
        if child:
            children.append(child)
    assert offset == end
    return {'name': name, 'values': values, 'children': children}


nodes = []
while True:
    entry = node()
    if not entry:
        break
    nodes.append(entry)


def child(entry, name):
    return next(x for x in entry['children'] if x['name'] == name)


if __name__ == '__main__':
    objects = next(x for x in nodes if x['name'] == 'Objects')['children']
    geo = next(x for x in objects if x['name'] == 'Geometry')
    vertices = child(geo, 'Vertices')['values'][0]
    indices = child(geo, 'PolygonVertexIndex')['values'][0]
    normal = child(child(geo, 'LayerElementNormal'), 'Normals')['values'][0]
    uv_layer = child(geo, 'LayerElementUV')
    uv = child(uv_layer, 'UV')['values'][0]
    uv_indices = child(uv_layer, 'UVIndex')['values'][0]
    materials = child(child(geo, 'LayerElementMaterial'), 'Materials')['values'][0]
    # The supplied FBX has a -90 degree X model rotation: convert Z-up to Y-up.
    points = [(vertices[i], vertices[i + 2], -vertices[i + 1]) for i in range(0, len(vertices), 3)]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    scale = 2.8 / max(high[i] - low[i] for i in range(3))
    center = [(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2]
    meshes = [[], []]
    face, polygon = [], 0
    for corner, index in enumerate(indices):
        vertex = -index - 1 if index < 0 else index
        point = points[vertex]
        n = normal[corner * 3:corner * 3 + 3]
        u = uv_indices[corner] * 2
        face.append([(point[i] - center[i]) * scale for i in range(3)] + [n[0], n[2], -n[1]] + uv[u:u + 2])
        if index < 0:
            for i in range(1, len(face) - 1):
                for v in (face[0], face[i], face[i + 1]):
                    meshes[materials[polygon]].extend(round(x, 6) for x in v)
            face = []
            polygon += 1
    output = ROOT / 'assets/maxwell'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'mesh.js').write_text('// Derived from the user-supplied Maxwell FBX. Regenerate with scripts/convert-maxwell.py.\n'
                                  'globalThis.MaxwellMesh=' + json.dumps(meshes, separators=(',', ':')) + ';\n', encoding='utf8')
    print('Maxwell:', len(points), 'vertices,', sum(len(m) // 24 for m in meshes), 'triangles; bounds', low, high)

import codecs

with open('backend/crud.py', 'rb') as f:
    content = f.read()

content = content.replace(b'\x00', b'')

with open('backend/crud.py', 'wb') as f:
    f.write(content)

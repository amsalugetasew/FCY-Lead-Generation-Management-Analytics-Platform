import re

with open('backend/crud.py', 'r', encoding='utf-8') as f:
    crud_content = f.read()
    
with open('rankings_snippet.py', 'r', encoding='utf-8') as f:
    snippet = f.read()

# We need to find where def get_rankings starts and replace it
# get_rankings ends with `return rankings[:limit]`
match = re.search(r'def get_rankings\(.*?(?:return rankings\[:limit\])', crud_content, re.DOTALL)
if match:
    crud_content = crud_content[:match.start()] + snippet + crud_content[match.end():]
    with open('backend/crud.py', 'w', encoding='utf-8') as f:
        f.write(crud_content)
    print("Replaced successfully")
else:
    print("Could not find get_rankings")

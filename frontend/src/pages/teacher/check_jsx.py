import sys
import re

def check_jsx_stack(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    clean_content = list(content)
    for match in re.finditer(r'\{/\*.*?\*/\}', content, flags=re.DOTALL):
        for i in range(match.start(), match.end()):
            if clean_content[i] != '\n':
                clean_content[i] = ' '
    content = "".join(clean_content)
    
    stack = []
    i = 0
    while i < len(content):
        if content.startswith('<div', i):
            tag_end = content.find('>', i)
            tag_text = content[i:tag_end+1]
            if not tag_text.endswith('/>'):
                line_no = content[:i].count('\n') + 1
                stack.append(('div', line_no, tag_text[:50]))
            i = tag_end + 1
        elif content.startswith('</div', i):
            if stack:
                stack.pop()
            else:
                line_no = content[:i].count('\n') + 1
                print(f"Unexpected </div> at line {line_no}")
            i += 5
        else:
            i += 1
            
    print(f"Still open: {len(stack)}")
    for s in stack:
        print(f"Prop {s[2]} at line {s[1]}")

if __name__ == '__main__':
    check_jsx_stack(sys.argv[1])

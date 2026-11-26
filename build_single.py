# 把 index.html + css/ + js/ 合併成單一檔 dist/index.html (方便部署到 Vercel 等靜態空間)
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root/'index.html').read_text(encoding='utf-8')
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
  lambda m: '<style>\n'+(root/m.group(1)).read_text(encoding='utf-8')+'\n</style>', html)
html = re.sub(r'<script src="(js/[^"]+)"></script>',
  lambda m: '<script>\n'+(root/m.group(1)).read_text(encoding='utf-8').replace('</script','<\\/script')+'\n</script>', html)
out = root/'dist'; out.mkdir(exist_ok=True)
(out/'index.html').write_text(html, encoding='utf-8')
print('OK', out/'index.html', len(html)//1024, 'KB')

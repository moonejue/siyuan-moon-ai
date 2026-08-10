#!/usr/bin/env python3

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent.parent
WIDTH, HEIGHT = 1024, 768
SANS = "/System/Library/Fonts/STHeiti Light.ttc"
SANS_MEDIUM = "/System/Library/Fonts/STHeiti Medium.ttc"
SERIF = "/System/Library/Fonts/Supplemental/Songti.ttc"
LATIN = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def label(draw, position, text, size=12, fill="#3f4740", face=SANS, anchor=None):
    draw.text(position, text, font=font(face, size), fill=fill, anchor=anchor)


canvas = Image.new("RGB", (WIDTH, HEIGHT), "#eef0ed")
draw = ImageDraw.Draw(canvas)

# Brand panel
draw.rectangle((0, 0, 388, HEIGHT), fill="#27302a")
draw.ellipse((222, 578, 498, 854), outline="#665f4f", width=1)
draw.ellipse((258, 614, 462, 818), outline="#443f36", width=1)

icon = Image.open(ROOT / "icon.png").convert("RGBA").resize((72, 72), Image.Resampling.LANCZOS)
icon_shadow = Image.new("RGBA", (112, 112), (0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(icon_shadow)
shadow_draw.rounded_rectangle((20, 20, 92, 92), radius=16, fill=(0, 0, 0, 140))
icon_shadow = icon_shadow.filter(ImageFilter.GaussianBlur(12))
canvas.paste(icon_shadow, (28, 42), icon_shadow)
canvas.paste(icon, (48, 62), icon)

label(draw, (48, 178), "MOON AI · SIYUAN", 12, "#d1b98e", LATIN)
label(draw, (48, 220), "月照 AI", 40, "#f7f4ec", SERIF)
label(draw, (48, 273), "笔记助手", 40, "#f7f4ec", SERIF)
label(draw, (48, 336), "引用你的笔记，让回答回到", 14, "#c8cec8")
label(draw, (48, 363), "你的知识与文字里。", 14, "#c8cec8")

for y, text in (
    (594, "多篇笔记引用与上下文问答"),
    (628, "划词润色、总结、改写与续写"),
    (662, "结果对照、编辑并写回思源"),
):
    draw.ellipse((49, y - 3, 57, y + 5), fill="#c6a96f")
    label(draw, (70, y - 7), text, 13, "#e5e8e3")

# App window and shadow
window = (418, 30, 996, 738)
shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(shadow)
shadow_draw.rounded_rectangle((428, 44, 986, 742), radius=12, fill=(38, 48, 41, 75))
shadow = shadow.filter(ImageFilter.GaussianBlur(22))
canvas.paste(shadow, (0, 0), shadow)
rounded(draw, window, 8, "#ffffff", "#d4d9d3")

# Window chrome
draw.rectangle((419, 31, 995, 67), fill="#f7f8f7")
draw.line((418, 68, 996, 68), fill="#dfe3df")
for x in (435, 450, 465):
    draw.ellipse((x - 4, 45, x + 4, 53), fill="#cfd4cf")
label(draw, (707, 49), "思源笔记 · 月照 AI", 10, "#777f78", anchor="mm")
label(draw, (975, 49), "右侧栏", 10, "#a2a8a2", anchor="rm")

# Plugin header
draw.rectangle((419, 69, 995, 737), fill="#f7f4ec")
draw.rectangle((419, 69, 995, 168), fill="#f0ede5")
draw.ellipse((440, 94, 476, 130), outline="#71846e", width=2)
draw.ellipse((449, 86, 485, 122), fill="#f0ede5")
label(draw, (489, 90), "MOON AI · SIYUAN", 8, "#71846e", LATIN)
label(draw, (489, 109), "月照 AI", 22, "#313932", SERIF)
label(draw, (489, 139), "引用你的笔记，让回答回到你的知识与文字里。", 10, "#7c827c")
rounded(draw, (833, 92, 967, 122), 7, "#faf9f5", "#cdd3cc")
label(draw, (900, 107), "DeepSeek · 写作方案", 10, "#59665a", anchor="mm")

# Tabs
draw.rectangle((419, 168, 995, 210), fill="#f7f4ec")
label(draw, (455, 181), "对话与修改", 11, "#556555")
label(draw, (553, 181), "快捷指令", 11, "#8a908a")
label(draw, (632, 181), "AI 设置", 11, "#8a908a")
draw.line((438, 209, 528, 209), fill="#71846e", width=2)

# Workbench
label(draw, (446, 233), "01", 11, "#71846e", LATIN)
label(draw, (478, 229), "向 AI 提问", 15, "#313932", SERIF)
label(draw, (967, 239), "已连接 3 篇笔记", 10, "#788078", anchor="ra")

rounded(draw, (446, 265, 646, 299), 7, "#edf1ec", "#b9c3b8")
label(draw, (459, 274), "◇", 13, "#71846e", SERIF)
label(draw, (480, 274), "清明不是用来端着的", 10, "#3e473f")
label(draw, (632, 282), "写回目标", 8, "#829082", anchor="rm")
rounded(draw, (654, 265, 776, 299), 7, "#faf9f5", "#d7dbd5")
label(draw, (669, 275), "○", 11, "#8b948b", SERIF)
label(draw, (689, 274), "生活里修行", 10, "#535b54")

for box, mark, text in (
    ((446, 321, 513, 351), "润", "润色"),
    ((521, 321, 609, 351), "摘", "提炼金句"),
    ((617, 321, 695, 351), "续", "继续写"),
):
    rounded(draw, box, 15, "#fbfaf6", "#ccd2cb")
    label(draw, (box[0] + 12, box[1] + 8), mark, 10, "#71846e")
    label(draw, (box[0] + 34, box[1] + 8), text, 10, "#424b43")

# Prompt
rounded(draw, (446, 369, 968, 494), 10, "#fbfaf7", "#bdc8bc")
label(draw, (463, 388), "请结合引用笔记，梳理这篇文章的核心观点，", 11, "#454d46")
label(draw, (463, 410), "并保持温柔、清晰的表达。", 11, "#454d46")
draw.line((463, 449, 951, 449), fill="#e0e3de")
rounded(draw, (463, 460, 556, 484), 6, "#eef2ed", "#d5dbd4")
label(draw, (509, 472), "@ 引用当前笔记", 9, "#627262", anchor="mm")
label(draw, (567, 465), "3 篇上下文", 9, "#8b918b")
rounded(draw, (862, 456, 951, 486), 7, "#637663")
label(draw, (906, 471), "开始回答 ↗", 10, "#fbfaf5", anchor="mm")

# Answer
rounded(draw, (446, 516, 968, 692), 10, "#f3f0e8", "#d8dbd4")
draw.line((446, 555, 968, 555), fill="#d8dbd4")
draw.ellipse((462, 533, 468, 539), fill="#71846e")
label(draw, (477, 528), "AI 回答", 10, "#3d453e")
for box, text, color in (
    ((780, 524, 822, 548), "复制", "#555d56"),
    ((828, 524, 889, 548), "追加到目标", "#555d56"),
    ((895, 524, 956, 548), "替换目标", "#765f57"),
):
    rounded(draw, box, 5, "#fbfaf7", "#d7dad4")
    label(draw, ((box[0] + box[2]) // 2, 536), text, 8, color, anchor="mm")

label(draw, (465, 577), "清明不是一个需要抓住的状态，而是一个可以随时回来", 11, "#3f4740")
label(draw, (465, 599), "对照的参考点。", 11, "#3f4740")
label(draw, (465, 635), "真正的练习，是在生活起波澜时看见自己，然后轻轻修正，", 11, "#3f4740")
label(draw, (465, 657), "继续往前走。", 11, "#3f4740")

canvas.save(ROOT / "preview.png", optimize=True)
print(f"Created {ROOT / 'preview.png'} ({WIDTH}x{HEIGHT})")

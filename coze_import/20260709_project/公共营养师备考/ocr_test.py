from pdf2image import convert_from_path
import pytesseract

pdf_path = "用户上传/中国居民膳食指南(2022) (中国营养学会) (z-library.sk, 1lib.sk, z-lib.sk)_1778900614124_1iwf.pdf"

# Try OCR on a few key pages
# Pages around the 8 guidelines and dietary pagoda
pages_to_ocr = [6, 7, 8, 9, 10, 20, 30, 40, 50]

images = convert_from_path(pdf_path, first_page=6, last_page=10, dpi=200)
for i, img in enumerate(images):
    page_num = i + 6
    text = pytesseract.image_to_string(img, lang='chi_sim')
    print(f'=== Page {page_num} ===')
    print(text[:800])
    print()

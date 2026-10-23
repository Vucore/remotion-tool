import os
import cv2
import numpy as np
import requests
import onnxruntime as ort

MODEL_PATH = "lama_fp32.onnx"
MODEL_URL = "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx"

def ensure_model():
    """Tự động tải model LaMa ONNX nếu chưa có trong thư mục."""
    if not os.path.exists(MODEL_PATH):
        print(f"[Thông báo] Đang tải AI Model (LaMa Inpainting)...")
        r = requests.get(MODEL_URL, allow_redirects=True, stream=True)
        if r.status_code == 200:
            with open(MODEL_PATH, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)
            print("[Thành công] Đã tải xong model!")
        else:
            raise RuntimeError(f"Không thể tải model từ {MODEL_URL}")

# Khởi tạo model AI
ensure_model()
session = ort.InferenceSession(MODEL_PATH)

def remove_logo(image_path, output_path, 
                 logo_w_ratio=0.052, logo_h_ratio=0.085,
                 margin_x_ratio=0.065, margin_y_ratio=0.115):
    img = cv2.imread(image_path)
    if img is None:
        print(f"[LỖI] Không thể đọc ảnh: {image_path}")
        return

    h_img, w_img, c_img = img.shape
    
    # 1. Cắt vùng góc dưới phải 512x512 để đưa vào mô hình LaMa AI
    crop_size = min(512, h_img, w_img)
    crop_x = w_img - crop_size
    crop_y = h_img - crop_size
    crop_img = img[crop_y:h_img, crop_x:w_img]
    
    # 2. Tính kích thước & vị trí logo
    logo_w = int(w_img * logo_w_ratio)
    logo_h = int(h_img * logo_h_ratio)
    margin_x = int(w_img * margin_x_ratio)
    margin_y = int(h_img * margin_y_ratio)
    
    x = w_img - logo_w - margin_x
    y = h_img - logo_h - margin_y
    
    filename = os.path.basename(image_path)
    print(f"[Đang xử lý AI] {filename}")
    print(f"  ├─ Kích thước ảnh: {w_img}x{h_img}px (Kênh màu: {c_img})")
    print(f"  └─ Vùng mask logo (x={x}, y={y}, w={logo_w}, h={logo_h})")
    
    # 3. Tạo mask nhị phân cho vùng crop
    crop_mask = np.zeros((crop_size, crop_size), dtype=np.uint8)
    mask_x = x - crop_x
    mask_y = y - crop_y
    crop_mask[mask_y:mask_y+logo_h, mask_x:mask_x+logo_w] = 255
    
    # 4. Chuẩn bị tensor cho AI
    img_rgb = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    img_tensor = np.transpose(img_rgb, (2, 0, 1))[np.newaxis, ...]
    mask_tensor = (crop_mask[np.newaxis, np.newaxis, ...] > 0).astype(np.float32)
    
    # 5. Chạy mô hình LaMa AI để khôi phục họa tiết & kết cấu nguyên vẹn
    outputs = session.run(None, {"image": img_tensor, "mask": mask_tensor})
    out = outputs[0][0]
    res_crop = np.transpose(out, (1, 2, 0))
    res_crop = np.clip(res_crop, 0, 255).astype(np.uint8)
    res_crop = cv2.cvtColor(res_crop, cv2.COLOR_RGB2BGR)
    
    # 6. Ghép vùng đã inpaint vào ảnh gốc với viền làm mịn (Feathering)
    dilated_mask = cv2.dilate(crop_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    blur_mask = cv2.GaussianBlur(dilated_mask, (5, 5), 0) / 255.0
    blur_mask_3c = np.repeat(blur_mask[:, :, np.newaxis], 3, axis=2)
    
    final_crop = (res_crop * blur_mask_3c + crop_img * (1.0 - blur_mask_3c)).astype(np.uint8)
    
    res_img = img.copy()
    res_img[crop_y:h_img, crop_x:w_img] = final_crop
    
    # Lưu ảnh đúng định dạng
    ext = os.path.splitext(output_path)[1].lower()
    if ext in ('.jpg', '.jpeg'):
        cv2.imwrite(output_path, res_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    elif ext == '.png':
        cv2.imwrite(output_path, res_img, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    else:
        cv2.imwrite(output_path, res_img)

def batch_process(input_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    for fname in os.listdir(input_dir):
        if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            remove_logo(
                os.path.join(input_dir, fname),
                os.path.join(output_dir, fname)
            )

if __name__ == "__main__":
    import sys
    if "--web" in sys.argv or "-w" in sys.argv:
        from server import run as run_server
        run_server()
    else:
        batch_process("input", "output")
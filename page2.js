
// 角度滑桿與數字輸入同步
const angleInput = document.getElementById("angle");
const angleSlider = document.getElementById("angleSlider");
const angleDisplay = document.getElementById("angleDisplay");

// 畫布與繪圖環境
const canvas = document.getElementById("trajCanvas");
let ctx = null;
if (canvas) {
    ctx = canvas.getContext("2d");
}

if (angleInput && angleSlider && angleDisplay) {
    // 載入時先同步一次
    angleSlider.value = angleInput.value;
    angleDisplay.textContent = angleInput.value + "°";

    angleInput.addEventListener("input", function () {
        angleSlider.value = angleInput.value;
        angleDisplay.textContent = angleInput.value + "°";
    });

    angleSlider.addEventListener("input", function () {
        angleInput.value = angleSlider.value;
        angleDisplay.textContent = angleSlider.value + "°";
    });
}

const btn = document.getElementById("calcJumpBall");
const resultEl = document.getElementById("jumpResult");
const errorEl = document.getElementById("jumpError");

if (btn) {
    btn.onclick = function () {
        errorEl.textContent = "";
        resultEl.textContent = "";

        // 讀取輸入值
        const H = parseFloat(document.getElementById("height").value);
        const L = parseFloat(document.getElementById("distance").value);
        const thetaDeg = parseFloat(document.getElementById("angle").value);
        const g = parseFloat(document.getElementById("gravity").value);

        // 基本檢查
        if (isNaN(H) || isNaN(L) || isNaN(thetaDeg) || isNaN(g)) {
            errorEl.textContent = "請輸入所有欄位！";
            clearCanvas();
            return;
        }
        if (H <= 0 || L <= 0 || g <= 0) {
            errorEl.textContent = "高度 H、距離 L、重力 g 必須為正數。";
            clearCanvas();
            return;
        }

        // 角度轉弧度
        const theta = thetaDeg * Math.PI / 180;

        const cosTheta = Math.cos(theta);
        const tanTheta = Math.tan(theta);

        // cosθ 太接近 0 會爆掉（例如 90°）
        if (Math.abs(cosTheta) < 1e-6) {
            errorEl.textContent = "角度太接近 90°，水平方向速度幾乎為 0，無法計算。";
            clearCanvas();
            return;
        }

        const denom = 2 * cosTheta * cosTheta * (H + L * tanTheta);

        if (denom <= 0) {
            errorEl.textContent = "以目前的高度、距離與角度，物理上無法達到這個落點。請調整參數。";
            clearCanvas();
            return;
        }

        // v0 = L * sqrt( g / (2 cos^2θ (H + L tanθ)) )
        const v0 = L * Math.sqrt(g / denom);

        resultEl.textContent = "所需初速度 v₀ ≈ " + v0.toFixed(2) + " m/s";

        // 畫拋物線軌跡
        if (ctx && canvas) {
            drawTrajectory(ctx, canvas, v0, theta, H, g, L);
        }
    };
}

// 清除畫布
function clearCanvas() {
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// 繪製拋物線軌跡
// 繪製拋物線軌跡（固定畫布大小，有高度上限、建築物、角度標示）
// 繪製拋物線軌跡：
// - 拋物線起點在建築物右上角 (0, H)
// - 綠色箭頭方向就是輸入的角度 θ
// - 畫布大小固定，高度有顯示上限
// 等比例縮放版：H、L 比例正確，θ 角度視覺上也正確
function drawTrajectory(ctx, canvas, v0, theta, H, g, L) {
    // 固定畫布大小
    canvas.width = 500;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;
    const margin = 40;

    // ===== 物理空間設定 =====
    // 建築物寬度（世界座標，單位 m，純視覺）
    const buildingWidth = Math.min(3, L * 0.3 + 1);

    // 拋出點在建築物右上角 (x = 0, y = H)
    const launchWorld = { x: 0, y: H };

    // 水平顯示範圍：從建築物左邊到落地點右邊一點
    const xMin = -buildingWidth;
    const xMax = L * 1.1;

    // 拋物線最高點
    const v0y = v0 * Math.sin(theta);
    const hMax = H + (v0y * v0y) / (2 * g);

    // 垂直顯示上限（超過就截掉）
    const MAX_DISPLAY_HEIGHT = 40;   // 單位 m，想改就在這裡改
    const yMin = 0;
    const yMaxDisplay = Math.min(hMax, MAX_DISPLAY_HEIGHT);

    const worldWidth  = xMax - xMin;
    const worldHeight = yMaxDisplay - yMin;

    // ===== 等比例縮放，X、Y 共用同一個 SCALE =====
    const SCALE = Math.min(
        (width  - 2 * margin) / worldWidth,
        (height - 2 * margin) / worldHeight
    );

    // 世界座標 → 畫布座標（等比例）
    function toScreen(x, y) {
        const sx = margin + (x - xMin) * SCALE;
        const sy = height - margin - (y - yMin) * SCALE; // y 向上為正
        return { x: sx, y: sy };
    }

    // ===== 1. 畫地面 =====
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    const groundLeft  = toScreen(xMin, 0);
    const groundRight = toScreen(xMax, 0);

    ctx.beginPath();
    ctx.moveTo(groundLeft.x, groundLeft.y);
    ctx.lineTo(groundRight.x, groundRight.y);
    ctx.stroke();

    // ===== 2. 畫建築物（左灰色矩形）=====
    const bBottomLeft = toScreen(xMin, 0);
    const bTopRight   = toScreen(0, H);

    const bWidthPx  = bTopRight.x - bBottomLeft.x;
    const bHeightPx = bBottomLeft.y - bTopRight.y;

    ctx.fillStyle = "#dddddd";
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(bBottomLeft.x, bTopRight.y, bWidthPx, bHeightPx);
    ctx.fill();
    ctx.stroke();

    // ===== 3. 拋物線（紅色），起點在建築物右上角 (0, H) =====
    const v0x = v0 * Math.cos(theta);
    const totalTime = L / v0x;  // 飛到水平 L 的時間
    const steps = 150;

    ctx.beginPath();
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2;

    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * totalTime;
        const x = v0x * t;                             // 從 x = 0 開始
        const y = H + v0y * t - 0.5 * g * t * t;       // 從 y = H 開始

        const p = toScreen(x, y);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // ===== 4. 標示 H 和 L（比例正確）=====
    ctx.fillStyle = "#000000";
    ctx.font = "12px Arial";

    ctx.fillText("樓高 H = " + H + " m",
                 bTopRight.x + 5, bTopRight.y + 15);

    const landing = toScreen(L, 0);
    ctx.fillText("水平距離 L = " + L + " m",
                 landing.x - 60, landing.y + 15);

    // ===== 5. 畫角度箭頭（真正的 θ，等比例，所以看起來就是 45°）=====
    const launchPoint = toScreen(launchWorld.x, launchWorld.y);

    // 箭頭長度（世界座標）
    const arrowLen = Math.min(3, L * 0.4 + 1);
    const arrowEndWorld = {
        x: launchWorld.x + arrowLen * Math.cos(theta),
        y: launchWorld.y + arrowLen * Math.sin(theta)
    };
    const arrowEnd = toScreen(arrowEndWorld.x, arrowEndWorld.y);

    // 箭身
    ctx.strokeStyle = "#007700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(launchPoint.x, launchPoint.y);
    ctx.lineTo(arrowEnd.x, arrowEnd.y);
    ctx.stroke();

    // 箭頭（三角形）
    const headLen = 10;
    const angleCanvas = Math.atan2(
        arrowEnd.y - launchPoint.y,
        arrowEnd.x - launchPoint.x
    );
    ctx.beginPath();
    ctx.moveTo(arrowEnd.x, arrowEnd.y);
    ctx.lineTo(
        arrowEnd.x - headLen * Math.cos(angleCanvas - Math.PI / 6),
        arrowEnd.y - headLen * Math.sin(angleCanvas - Math.PI / 6)
    );
    ctx.lineTo(
        arrowEnd.x - headLen * Math.cos(angleCanvas + Math.PI / 6),
        arrowEnd.y - headLen * Math.sin(angleCanvas + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = "#007700";
    ctx.fill();

    // 角度文字（真實角度）
    const degree = (theta * 180 / Math.PI).toFixed(1);
    ctx.fillStyle = "#000000";
    ctx.font = "14px Arial";
    ctx.fillText("θ ≈ " + degree + "°", arrowEnd.x + 5, arrowEnd.y - 5);

    // ===== 6. 高度超過上限時的提示 =====
    if (hMax > MAX_DISPLAY_HEIGHT) {
        ctx.fillStyle = "red";
        ctx.font = "12px Arial";
        ctx.fillText(
            "※ 最高點超過 " + MAX_DISPLAY_HEIGHT +
            " m，圖形上方已截斷",
            margin, margin - 10
        );
    }
}





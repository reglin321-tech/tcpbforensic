const angleSlider = document.getElementById("angleSlider");
const angleDisplay = document.getElementById("angleDisplay");
const angleInput = document.getElementById("angle"); // 確保 HTML 有這個數字輸入框
const canvas = document.getElementById("trajCanvas");
const ctx = canvas.getContext("2d");

// --- 1. 增強型角度連動邏輯 ---
function updateAngle(val) {
    let value = parseFloat(val);
    if (value > 90) value = 90;
    if (value < -90) value = -90;

    angleSlider.value = value;
    if (angleInput) angleInput.value = value;
    angleDisplay.textContent = value + "°";
}

angleSlider.oninput = (e) => updateAngle(e.target.value);
if (angleInput) {
    angleInput.oninput = (e) => updateAngle(e.target.value);
}

// --- 2. 物理計算核心 ---
document.getElementById("calcJumpBall").onclick = function() {
    const H = parseFloat(document.getElementById("height").value);
    const L = parseFloat(document.getElementById("distance").value);
    const thetaDeg = parseFloat(angleSlider.value);
    const g = 9.8;

    if (isNaN(H) || isNaN(L)) {
        alert("請輸入高度與距離");
        return;
    }

    const theta = thetaDeg * Math.PI / 180;
    const cosTheta = Math.cos(theta);
    const tanTheta = Math.tan(theta);

    // 防呆：垂直向上或向下時，水平位移 L 不可能由初速達成
    if (Math.abs(cosTheta) < 0.001) {
        document.getElementById("jumpError").innerText = "垂直角度無法達成水平位移。";
        return;
    }

    // 物理公式判斷根號內是否為正值
    const denom = 2 * cosTheta * cosTheta * (H + L * tanTheta);
    if (denom <= 0) {
        document.getElementById("jumpError").innerText = "在此角度下，物理上無法到達該目標。";
        return;
    }

    const v0 = L * Math.sqrt(g / denom);
    document.getElementById("jumpResult").innerText = "所需初速度 v₀ ≈ " + v0.toFixed(2) + " m/s";
    document.getElementById("jumpError").innerText = ""; // 清除錯誤

    drawTrajectory(v0, theta, H, g, L);
};

// --- 3. 自動適配繪圖邏輯 ---
function drawTrajectory(v0, theta, H, g, L) {
    canvas.width = 500;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const style = getComputedStyle(document.body);
    const primaryColor = style.getPropertyValue('--primary-color').trim() || "#2b6ad2";
    const canvasBg = style.getPropertyValue('--canvas-bg').trim() || "#ffffff";
    const textColor = style.getPropertyValue('--text-main').trim() || "#333";

    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 計算拋物線最高點以決定縮放比例
    const v0y = v0 * Math.sin(theta);
    const tMaxHeight = v0y / g;
    const hMax = (v0y > 0) ? H + (v0y * v0y) / (2 * g) : H;

    // 動態縮放比例 (留 20% 邊界)
    const margin = 50;
    const worldX = L * 1.2;
    const worldY = Math.max(H, hMax) * 1.2;
    const scale = Math.min((canvas.width - margin * 2) / worldX, (canvas.height - margin * 2) / worldY);

    function toScreen(x, y) {
        return {
            x: margin + x * scale,
            y: canvas.height - margin - y * scale
        };
    }

    // 畫地面
    ctx.beginPath();
    ctx.strokeStyle = "#ccc";
    ctx.setLineDash([5, 5]);
    const groundStart = toScreen(-worldX*0.1, 0);
    const groundEnd = toScreen(worldX, 0);
    ctx.moveTo(groundStart.x, groundStart.y);
    ctx.lineTo(groundEnd.x, groundEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 畫建築
    ctx.fillStyle = "#888";
    const bTop = toScreen(0, H);
    const bBase = toScreen(0, 0);
    ctx.fillRect(bTop.x - 15, bTop.y, 15, bBase.y - bTop.y);

    // 畫拋物線軌跡
    ctx.beginPath();
    ctx.strokeStyle = primaryColor; // 使用馬卡龍配色或預設藍
    ctx.lineWidth = 3;

    const v0x = v0 * Math.cos(theta);
    const totalTime = L / v0x;

    for (let t = 0; t <= totalTime; t += totalTime / 60) {
        const x = v0x * t;
        const y = H + v0y * t - 0.5 * g * t * t;
        const p = toScreen(x, y);
        if (t === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // 標註起點與終點
    ctx.fillStyle = "#ff4444";
    const startP = toScreen(0, H);
    const endP = toScreen(L, 0);
    ctx.beginPath(); ctx.arc(startP.x, startP.y, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(endP.x, endP.y, 4, 0, Math.PI*2); ctx.fill();
}
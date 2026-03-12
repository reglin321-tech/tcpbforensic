document.getElementById("calcBtn").onclick = function () {
    let M = parseFloat(document.getElementById("mass").value);
    let V = parseFloat(document.getElementById("velocity").value);

    if (isNaN(M) || isNaN(V)) {
        document.getElementById("result").innerText = "⚠️ 請輸入有效的數字！";
        return;
    }

    // 計算動能 KE = (M * V^2) / 2
    let KE = (M * V * V) / 2;

    document.getElementById("result").innerText = "動能 KE = " + KE.toFixed(2) + " 焦耳";
};
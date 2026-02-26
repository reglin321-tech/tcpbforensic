document.getElementById("calcBtn").onclick = function () {
    // 取得 M 和 V 的值
    let M = parseFloat(document.getElementById("mass").value);
    let V = parseFloat(document.getElementById("velocity").value);

    // 防呆：確認輸入不是空的
    if (isNaN(M) || isNaN(V)) {
        document.getElementById("result").innerText = "請輸入有效的 M 和 V！";
        return;
    }

    // 計算動能 KE = (M * V^2) / 2
    let KE = (M * V * V) / 2;

    // 顯示結果
    document.getElementById("result").innerText = "動能 KE = " + KE + " 焦耳";
};

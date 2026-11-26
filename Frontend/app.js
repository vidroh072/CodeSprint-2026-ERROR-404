// State (loaded from localStorage)
let autopays = JSON.parse(localStorage.getItem("upi_autopays")) || [];
let hiddenCuts = JSON.parse(localStorage.getItem("upi_hidden_cuts")) || [];
let currentFilter = "all";
let lastDisplayed = null;
let toastTimer = null;

// DOM Elements
const sampleSms = document.getElementById("sample-sms");
const smsInput = document.getElementById("sms-input");
const analyzeBtn = document.getElementById("analyze-btn");
const clearBtn = document.getElementById("clear-btn");

const resApp = document.getElementById("res-app");
const resAmount = document.getElementById("res-amount");
const resType = document.getElementById("res-type");
const resReason = document.getElementById("res-reason");
const resStatus = document.getElementById("res-status");

const statAutopays = document.getElementById("stat-autopays");
const statHidden = document.getElementById("stat-hidden");
const statUrgent = document.getElementById("stat-urgent");

const alertSection = document.getElementById("alert-section");
const alertText = document.getElementById("alert-text");

const autopayList = document.getElementById("autopay-list");
const hiddenCutsList = document.getElementById("hidden-cuts-list");
const hiddenTotal = document.getElementById("hidden-total");

const proofApp = document.getElementById("proof-app");
const proofFile = document.getElementById("proof-file");
const previewWrapper = document.getElementById("preview-wrapper");
const proofPreview = document.getElementById("proof-preview");
const uploadProofBtn = document.getElementById("upload-proof-btn");
const proofStatus = document.getElementById("proof-status");

const guideContent = document.getElementById("guide-content");
const toast = document.getElementById("toast");

// Reason Labels
const reasonMap = {
    game: "Game / In-App Purchase",
    trial: "Free Trial Auto-Renewal",
    subscription: "Recurring Subscription",
    sms: "Quarterly SMS Alert Charge",
    convenience: "Platform Convenience Fee",
    maintenance: "Annual Card Maintenance Fee",
    fee: "Hidden Service Charge",
    general: "General Deduction"
};

// Cancel Guides
const cancelGuides = {
    gpay: {
        title: "Google Pay (GPay) Steps",
        steps: [
            "Open Google Pay and tap your Profile photo (top-right).",
            "Tap <strong>Autopay</strong> under Payment Methods.",
            "Select the active subscription you want to stop.",
            "Tap <strong>Cancel Autopay</strong> and confirm with your UPI PIN."
        ]
    },
    phonepe: {
        title: "PhonePe Steps",
        steps: [
            "Open PhonePe and tap your Profile picture (top-left).",
            "Go to <strong>Payment Management → Autopay</strong>.",
            "Choose the merchant mandate from the list.",
            "Tap <strong>Delete / Remove Autopay</strong> and enter your UPI PIN."
        ]
    },
    paytm: {
        title: "Paytm Steps",
        steps: [
            "Open Paytm and tap your Profile icon (top-left).",
            "Select <strong>UPI & Payment Settings → Automatic Payments</strong>.",
            "Tap the active subscription you wish to cancel.",
            "Select <strong>Cancel Automatic Payment</strong> and verify with UPI PIN."
        ]
    },
    bhim: {
        title: "BHIM UPI Steps",
        steps: [
            "Open the BHIM app and log in with your passcode.",
            "Tap <strong>UPI Mandate</strong> on the home screen.",
            "Go to the <strong>Active</strong> tab and pick the mandate.",
            "Tap <strong>Revoke Mandate</strong> and confirm using your UPI PIN."
        ]
    }
};

// Get Reason Text
function getReasonText(item) {
    if (item.reasonKey && reasonMap[item.reasonKey]) {
        return reasonMap[item.reasonKey];
    }
    return item.reason || reasonMap.general;
}

// Save data to localStorage
function saveData() {
    localStorage.setItem("upi_autopays", JSON.stringify(autopays));
    localStorage.setItem("upi_hidden_cuts", JSON.stringify(hiddenCuts));
}

// Show Toast Notification (overlap-safe)
function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// SMS Parser Logic (Banks, Apps & Games)
function parseSMS(text) {
    const lowerText = text.toLowerCase();

    // Extract Amount (handles commas like Rs.1,499 or ₹2,500.50)
    const amountMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i);
    const amount = amountMatch ? Math.round(parseFloat(amountMatch[1].replace(/,/g, ""))) : 0;

    // Detect Type
    let type = "Hidden Cut";
    if (
        lowerText.includes("autopay") ||
        lowerText.includes("auto-debit") ||
        lowerText.includes("mandate") ||
        lowerText.includes("subscription") ||
        lowerText.includes("trial") ||
        lowerText.includes("renew")
    ) {
        type = "Autopay";
    }

    // Extract App / Bank / Game Name
    let app = "Unknown Bank/App";
    const knownApps = [
        "Free Fire", "Garena", "BGMI", "PUBG", "Call of Duty", "CODM",
        "Roblox", "Valorant", "Dream11", "MPL", "WinZO", "My11Circle",
        "Google Play", "Play Store", "App Store", "Codashop", "Steam",
        "Netflix", "Spotify", "Amazon Prime", "Amazon", "Hotstar", "Disney+",
        "JioCinema", "SonyLIV", "Zee5", "YouTube", "Apple",
        "Zomato", "Swiggy", "Blinkit", "Zepto", "Airtel", "Jio", "Vi",
        "HDFC Bank", "HDFC", "SBI Bank", "SBI", "ICICI Bank", "ICICI",
        "Axis Bank", "Kotak", "PNB", "Punjab National Bank", "Bank of Baroda",
        "BOB", "Canara Bank", "Union Bank", "Yes Bank", "IndusInd",
        "IDFC", "Paytm", "PhonePe", "GPay", "Bajaj Finserv"
    ];

    for (let name of knownApps) {
        if (lowerText.includes(name.toLowerCase())) {
            app = name;
            break;
        }
    }

    // Detect Reason
    let reasonKey = "general";
    if (
        lowerText.includes("free fire") || lowerText.includes("bgmi") ||
        lowerText.includes("pubg") || lowerText.includes("diamonds") ||
        lowerText.includes("uc") || lowerText.includes("top-up") ||
        lowerText.includes("play store") || lowerText.includes("google play") ||
        lowerText.includes("game") || lowerText.includes("dream11")
    ) {
        reasonKey = "game";
    } else if (lowerText.includes("trial")) {
        reasonKey = "trial";
    } else if (lowerText.includes("subscription") || lowerText.includes("renew")) {
        reasonKey = "subscription";
    } else if (lowerText.includes("sms alert")) {
        reasonKey = "sms";
    } else if (lowerText.includes("convenience fee")) {
        reasonKey = "convenience";
    } else if (lowerText.includes("maintenance")) {
        reasonKey = "maintenance";
    } else if (lowerText.includes("charge") || lowerText.includes("fee")) {
        reasonKey = "fee";
    }

    // Extract Countdown Days
    const daysMatch = text.match(/in\s+(\d+)\s+days?/i);
    const daysLeft = daysMatch ? parseInt(daysMatch[1], 10) : 7;

    return { app, amount, type, reasonKey, daysLeft };
}

// Update Extracted Details Card
function updateExtractedCard(item) {
    lastDisplayed = item;

    resApp.textContent = item.app;
    resAmount.textContent = item.amount;
    resReason.textContent = getReasonText(item);

    if (item.type === "Autopay") {
        resType.textContent = "Autopay";
        resType.className = "badge badge-autopay";
        if (resStatus) {
            if (item.cancelled) {
                resStatus.textContent = "Cancelled";
                resStatus.className = "badge badge-cancelled";
            } else {
                resStatus.textContent = "Active";
                resStatus.className = "badge badge-active";
            }
        }
    } else {
        resType.textContent = "Hidden Cut";
        resType.className = "badge badge-hidden";
        if (resStatus) {
            resStatus.textContent = "Deducted";
            resStatus.className = "badge badge-hidden";
        }
    }

    document.querySelectorAll(".extract-item").forEach((el) => {
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
    });
}

// Analyze & Add SMS
function analyzeText(text) {
    const data = parseSMS(text);

    if (data.type === "Autopay") {
        // Prevent duplicate active autopay entries
        const duplicate = autopays.find(
            (a) => !a.cancelled && a.app === data.app && a.amount === data.amount && a.daysLeft === data.daysLeft
        );
        if (duplicate) {
            updateExtractedCard({ ...duplicate, type: "Autopay" });
            showToast(`ℹ️ ${data.app} (₹${data.amount}) is already in Active Autopays.`);
            return;
        }

        const newItem = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            app: data.app,
            amount: data.amount,
            type: "Autopay",
            reasonKey: data.reasonKey,
            daysLeft: data.daysLeft,
            cancelled: false,
            proofName: ""
        };
        autopays.unshift(newItem);
        updateExtractedCard(newItem);
        showToast(`⏳ Detected ${data.app} Autopay (₹${data.amount})`);
    } else {
        const newItem = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            app: data.app,
            type: "Hidden Cut",
            reasonKey: data.reasonKey,
            amount: data.amount
        };
        hiddenCuts.unshift(newItem);
        updateExtractedCard(newItem);
        showToast(`💸 Detected Hidden Cut: ${data.app} (₹${data.amount})`);
    }

    saveData();
    renderAll();
}

// Render Everything
function renderAll() {
    renderAutopays();
    renderHiddenCuts();
    updateStatsAndAlerts();
}

// Render Active Autopays List
function renderAutopays() {
    proofApp.innerHTML = '<option value="">-- Select Active Autopay --</option>';

    autopays.forEach((item) => {
        if (!item.cancelled) {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = `${item.app} (₹${item.amount} - ${item.daysLeft}d)`;
            proofApp.appendChild(option);
        }
    });

    const filtered = autopays.filter((item) => {
        if (currentFilter === "active") return !item.cancelled;
        if (currentFilter === "cancelled") return item.cancelled;
        return true;
    });

    if (filtered.length === 0) {
        autopayList.innerHTML = '<p class="empty-msg">No autopays in this view.</p>';
        return;
    }

    autopayList.innerHTML = "";
    filtered.forEach((item) => {
        const isUrgent = !item.cancelled && item.daysLeft <= 3;
        const div = document.createElement("div");
        div.className = `autopay-item ${item.cancelled ? "cancelled" : isUrgent ? "urgent-card" : ""}`;

        const daysText = `Deducts in ${item.daysLeft} day${item.daysLeft > 1 ? "s" : ""}`;

        const rightSide = item.cancelled
            ? `<div style="text-align:right;">
                    <strong style="color:#16a34a;">✅ Cancelled</strong><br>
                    <small style="color:#475569;">Proof: ${item.proofName}</small>
               </div>`
            : `<div style="text-align:right;">
                    <strong style="color:${isUrgent ? "#dc2626" : "#2563eb"};">
                        ${isUrgent ? "🔥" : "⏳"} ${daysText}
                    </strong><br>
                    <button class="quick-cancel-btn" onclick="selectForCancel(event, ${item.id})">Cancel & Upload Proof</button>
               </div>`;

        div.innerHTML = `
            <div>
                <strong style="font-size:15px;">${item.app}</strong> — <strong style="color:#0f172a;">₹${item.amount}</strong><br>
                <small style="color:#64748b;">${getReasonText(item)}</small>
            </div>
            ${rightSide}
        `;
        div.style.cursor = "pointer";
        div.addEventListener("click", () => updateExtractedCard({ ...item, type: "Autopay" }));
        autopayList.appendChild(div);
    });
}

window.selectForCancel = function (event, id) {
    event.stopPropagation();
    proofApp.value = id;
    const item = autopays.find((a) => a.id == id);
    if (item) updateExtractedCard({ ...item, type: "Autopay" });
    document.getElementById("cancel-section").scrollIntoView({ behavior: "smooth" });
    showToast("Selected autopay. Upload cancellation screenshot below.");
};

// Render Hidden Cuts Table
function renderHiddenCuts() {
    let total = 0;

    if (hiddenCuts.length === 0) {
        hiddenCutsList.innerHTML = '<tr><td colspan="4" class="empty-msg">No hidden deductions found yet.</td></tr>';
        hiddenTotal.textContent = "0";
        return;
    }

    hiddenCutsList.innerHTML = "";
    hiddenCuts.forEach((item) => {
        total += item.amount;
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.innerHTML = `
            <td><strong>${item.app}</strong></td>
            <td>${getReasonText(item)}</td>
            <td style="color:#dc2626; font-weight:700;">₹${item.amount}</td>
            <td><button class="delete-row-btn" onclick="deleteHiddenCut(event, ${item.id})">✕</button></td>
        `;
        row.addEventListener("click", () => updateExtractedCard({ ...item, type: "Hidden Cut" }));
        hiddenCutsList.appendChild(row);
    });

    hiddenTotal.textContent = total;
}

window.deleteHiddenCut = function (event, id) {
    event.stopPropagation();
    hiddenCuts = hiddenCuts.filter((item) => item.id !== id);
    saveData();
    renderAll();
    showToast("Removed hidden deduction entry.");
};

// Update Stats & Top Alert Banner
function updateStatsAndAlerts() {
    const activeItems = autopays.filter((a) => !a.cancelled);
    const urgentItems = activeItems.filter((a) => a.daysLeft <= 3);
    const totalHidden = hiddenCuts.reduce((sum, item) => sum + item.amount, 0);

    statAutopays.textContent = activeItems.length;
    statHidden.textContent = totalHidden;
    statUrgent.textContent = urgentItems.length;

    if (urgentItems.length > 0) {
        const list = urgentItems.map((u) => `${u.app} (₹${u.amount} - ${u.daysLeft}d)`).join(" • ");
        alertText.textContent = `Urgent Upcoming Deductions: ${list}`;
        alertSection.classList.add("urgent");
    } else {
        alertText.textContent = "No urgent deductions in the next 3 days. You're safe!";
        alertSection.classList.remove("urgent");
    }
}

// Render Cancel Guide Tab
function renderGuide(appKey) {
    const guide = cancelGuides[appKey];
    guideContent.innerHTML = `
        <strong>${guide.title}</strong>
        <ol>${guide.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
    `;
}

// Event Listeners
sampleSms.addEventListener("change", () => {
    smsInput.value = sampleSms.value;
});

analyzeBtn.addEventListener("click", () => {
    const text = smsInput.value.trim();
    if (!text) {
        showToast("⚠️ Please select or paste an SMS first!");
        return;
    }
    analyzeText(text);
});

clearBtn.addEventListener("click", () => {
    autopays = [];
    hiddenCuts = [];
    lastDisplayed = null;
    saveData();
    resApp.textContent = "-";
    resAmount.textContent = "0";
    resType.textContent = "-";
    resType.className = "badge badge-neutral";
    if (resStatus) {
        resStatus.textContent = "-";
        resStatus.className = "badge badge-neutral";
    }
    resReason.textContent = "-";
    proofStatus.textContent = "";
    previewWrapper.classList.add("hidden");
    renderAll();
    showToast("🗑️ Dashboard cleared.");
});

document.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
        document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        currentFilter = pill.dataset.filter;
        renderAutopays();
    });
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderGuide(btn.dataset.tab);
    });
});

proofApp.addEventListener("change", () => {
    const item = autopays.find((a) => a.id == proofApp.value);
    if (item) updateExtractedCard({ ...item, type: "Autopay" });
});

proofFile.addEventListener("change", () => {
    const file = proofFile.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            proofPreview.src = e.target.result;
            previewWrapper.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    } else {
        previewWrapper.classList.add("hidden");
    }
});

// Submit Proof & Strict 3-Point OCR Verification (App Name + Amount + Cancel Status)
uploadProofBtn.addEventListener("click", async () => {
    const selectedId = proofApp.value;
    const file = proofFile.files[0];

    if (!selectedId) {
        showToast("⚠️ Select an active autopay first.");
        return;
    }
    if (!file) {
        showToast("⚠️ Please upload a cancellation screenshot.");
        return;
    }
    if (typeof Tesseract === "undefined") {
        proofStatus.style.color = "#dc2626";
        proofStatus.textContent = "❌ OCR library not loaded. Check internet connection and refresh.";
        return;
    }

    const item = autopays.find((a) => a.id == selectedId);
    if (!item) return;

    uploadProofBtn.disabled = true;
    uploadProofBtn.textContent = "🔍 Verifying Proof (OCR)...";
    proofStatus.style.color = "#2563eb";
    proofStatus.textContent = `⏳ Checking screenshot for "${item.app}", ₹${item.amount}, and cancellation status...`;

    try {
        const { data: { text } } = await Tesseract.recognize(file, "eng");
        const extracted = text.toLowerCase();
        const normalizedText = extracted.replace(/,/g, ""); // Remove commas for amount matching

        // 1. Check Cancellation Keyword
        const cancelKeywords = [
            "cancelled", "canceled", "revoked", "removed",
            "deleted", "paused", "stopped", "inactive"
        ];
        const hasCancelWord = cancelKeywords.find((word) => extracted.includes(word));

        // 2. Check Exact App Name (matches full name or primary word like "amazon" for "Amazon Prime")
        const appLower = item.app.toLowerCase();
        const primaryAppWord = appLower.split(" ")[0];
        const hasAppName =
            appLower === "unknown bank/app" ||
            extracted.includes(appLower) ||
            (primaryAppWord.length >= 3 && extracted.includes(primaryAppWord));

        // 3. Smart Amount Check: Only enforce if the screenshot actually shows a price
        const hasAnyMoneyInImage = /(?:rs\.?|inr|₹)\s*\d+/i.test(normalizedText);
        const amountRegex = new RegExp(`(?<!\\d)${item.amount}(?!\\d)`);
        const hasAmount = !hasAnyMoneyInImage || item.amount === 0 || amountRegex.test(normalizedText);

        if (hasCancelWord && hasAppName && hasAmount) {
            item.cancelled = true;
            item.proofName = file.name;
            saveData();
            renderAll();
            updateExtractedCard({ ...item, type: "Autopay" });
            proofStatus.style.color = "#16a34a";
            proofStatus.textContent = `✅ OCR Verified! Matched ${item.app}, ₹${item.amount}, and "${hasCancelWord}".`;
            proofFile.value = "";
            previewWrapper.classList.add("hidden");
            showToast(`✅ ${item.app} (₹${item.amount}) Cancelled!`);
        } else {
            const missing = [];
            if (!hasAppName) missing.push(`App name "${item.app}"`);
            if (!hasAmount) missing.push(`Amount "₹${item.amount}"`);
            if (!hasCancelWord) missing.push(`Cancellation status (Cancelled/Revoked/Removed)`);

            proofStatus.style.color = "#dc2626";
            proofStatus.textContent = `❌ Rejected! आपके द्वारा डाला गया SCREENSHOT वैध नहीं है।`;
            showToast("❌ Proof mismatch! Upload the correct screenshot.");
        }
    } catch (error) {
        proofStatus.style.color = "#dc2626";
        proofStatus.textContent = "❌ OCR scan failed. Check internet and try again.";
    } finally {
        uploadProofBtn.disabled = false;
        uploadProofBtn.textContent = "✅ Submit Proof & Mark Cancelled";
    }
});

// Initialize on page load
renderGuide("gpay");
renderAll();
const { createClient } = window.supabase;
const SUPABASE_URL = "https://fzoncqqwztcsqajjesrq.supabase.co";
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b25jcXF3enRjc3Fhamplc3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTMwNzAsImV4cCI6MjA5MDI2OTA3MH0.xfiXna3jPtTS5y6KkllT2_6CMuFGZA6qvX04JZLio8I";
const BUCKET_NAME = "Videos";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const uploadStatus = document.getElementById("uploadStatus");
const downloadStatus = document.getElementById("downloadStatus");
const totalCountEl = document.getElementById("totalCount");
const searchResultEl = document.getElementById("searchResult");
const searchInput = document.getElementById("searchInput");

// Load stats on page load
const loadStats = async () => {
    try {
        let allFiles = [];
        let page = 1;
        const pageSize = 1000;

        // Paginate through all files
        while (true) {
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .list("uploads/", {
                    limit: pageSize,
                    offset: (page - 1) * pageSize
                });

            if (error) {
                console.error("Stats error:", error);
                totalCountEl.textContent = "Error";
                return;
            }

            if (!data || data.length === 0) break;

            allFiles = allFiles.concat(data);
            page++;
        }

        totalCountEl.textContent = allFiles.length;
        // bucketSizeEl.textContent = `${allFiles.length.toLocaleString()}`;
    } catch (err) {
        console.error("Load stats failed:", err);
        totalCountEl.textContent = "Error";
    }
};

// Search by filename
document.getElementById("searchBtn").addEventListener("click", async () => {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
        searchResultEl.style.display = "none";
        return;
    }

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list("uploads/", { limit: 1000 });

        if (error) {
            searchResultEl.textContent = "Search failed: " + error.message;
            searchResultEl.className = "search-result error";
            searchResultEl.style.display = "block";
            return;
        }

        const matches = data.filter((file) =>
            file.name.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
            searchResultEl.textContent = `No files found matching "${query}"`;
        } else {
            searchResultEl.innerHTML = `
        <strong>${matches.length} match:</strong><br>
        ${matches.slice(0, 10).map((file) => file.name).join("<br>")}
        ${matches.length > 10 ? "<br><em>...and more</em>" : ""}
      `;
        }

        searchResultEl.style.display = "block";
    } catch (err) {
        searchResultEl.textContent = "Search error: " + err.message;
        searchResultEl.style.display = "block";
    }
});

// upload functionality
document.getElementById("uploadBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("videoInput");
    const files = fileInput.files;

    if (!files || files.length === 0) {
        uploadStatus.textContent = "Please select at least one video file.";
        uploadStatus.className = "status error";
        return;
    }

    // Reset UI
    progressBar.style.width = "0%";
    progressText.textContent = `0 / ${files.length} files`;
    uploadStatus.textContent = "";
    uploadStatus.className = "status";

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `uploads/${file.name}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file, { upsert: false });

        if (error) {
            errorCount++;
            console.error("Upload failed:", fileName, error);
        } else {
            successCount++;
            console.log("Uploaded:", fileName);
        }

        // Update progress bar after each file
        const current = i + 1; // 1‑based
        const total = files.length;
        const percent = Math.floor((current * 100) / total);

        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${current} / ${total} files`;
    }

    // Upload finished
    if (errorCount > 0) {
        uploadStatus.textContent = `Upload done: ${successCount} ok, ${errorCount} failed.`;
        uploadStatus.className = "status error";
    } else {
        uploadStatus.textContent = `Upload OK! ${successCount} file(s) uploaded.`;
        uploadStatus.className = "status success";
    }
});

// --- 2. Download by filename (only file name, force download + page reload) ---
document.getElementById("downloadBtn").addEventListener("click", async () => {
    const filePathInput = document.getElementById("filePathInput");
    const rawFileName = filePathInput.value.trim();

    if (!rawFileName) {
        downloadStatus.textContent = "Please enter a file name (e.g. myvideo.mp4).";
        downloadStatus.className = "status error";
        return;
    }

    const filePath = `uploads/${rawFileName}`;

    try {
        const { data, error } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        if (error) {
            downloadStatus.textContent = "Failed to get URL: " + error.message;
            downloadStatus.className = "status error";
            console.error(error);
            return;
        }

        const downloadUrl = data.publicUrl;

        const res = await fetch(downloadUrl);
        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = rawFileName;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

        downloadStatus.textContent = "Download started... Page will refresh.";
        downloadStatus.className = "status success";

        // Refresh page after download is triggered
        setTimeout(() => window.location.reload(), 800);
    } catch (err) {
        downloadStatus.textContent = "Download error: " + err.message;
        downloadStatus.className = "status error";
    }
});

// Load stats when page loads
loadStats();
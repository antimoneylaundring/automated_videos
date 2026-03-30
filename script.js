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
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");

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
    const searchInput = document.getElementById("searchInput");
    const searchResultEl = document.getElementById("searchResult");

    const raw = searchInput.value;
    const lines = raw
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    if (lines.length === 0) {
        searchResultEl.textContent = "Please enter at least one URL, one per line.";
        searchResultEl.style.display = "block";
        return;
    }

    searchResultEl.textContent = "Searching in storage...";
    searchResultEl.style.display = "block";

    // Remove any old export button
    document.getElementById("exportExcelBtn")?.remove();

    try {
        // Load all files once (same folder as download)
        const { data: allFiles, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list("uploads/", { limit: 10000 });

        if (error) {
            searchResultEl.textContent = "Search failed: " + error.message;
            return;
        }

        const fileNamesInBucket = allFiles.map((f) => f.name.toLowerCase());

        const results = [];

        for (const url of lines) {
            // same cleaning as download: remove http/https, keep www, trim trailing /
            let cleaned = url
                .replace(/^https?:\/\//i, "")
                .replace(/\/+$/i, "");

            if (!cleaned) {
                results.push({ input: url, status: "invalid", fileName: null });
                continue;
            }

            const expectedFile = `${cleaned}.mp4`;
            const exists = fileNamesInBucket.includes(expectedFile.toLowerCase());

            results.push({
                input: url,
                status: exists ? "found" : "not-found",
                fileName: expectedFile,
            });
        }

        // Build HTML output
        const found = results.filter((r) => r.status === "found");
        const notFound = results.filter((r) => r.status === "not-found");
        const invalid = results.filter((r) => r.status === "invalid");

        let html = "";

        if (found.length > 0) {
            html += `<strong>Found: ${found.length} </strong>Urls video<br>`;
        }

        if (notFound.length > 0) {
            html += `<strong>Not Found: ${notFound.length} </strong>Urls Video<br>`;
            html += notFound.map((r) => r.input).join("<br>");
            html += "<br><br>";
        }

        if (invalid.length > 0) {
            html += `<strong>${invalid.length} invalid line(s):</strong><br>`;
            html += invalid.map((r) => r.input).join("<br>");
        }

        if (!html) html = "No valid input lines.";

        // Apply scrollable style to result box
        searchResultEl.style.cssText = `
            display: block;
            max-height: 225px;
            overflow-y: auto;
            padding: 12px 16px;
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 0.9rem;
            line-height: 1.7;
        `;
        searchResultEl.innerHTML = html;

        // Add Excel export button if there are results
        if (results.length > 0) {
            const exportBtn = document.createElement("button");
            exportBtn.id = "exportExcelBtn";
            exportBtn.textContent = "⬇ Export to Excel";
            exportBtn.style.cssText = `
                margin-top: 10px;
                padding: 8px 18px;
                background: #1d6f42;
                color: #fff;
                border: none;
                border-radius: 6px;
                font-size: 0.9rem;
                cursor: pointer;
                display: block;
            `;

            exportBtn.addEventListener("click", () => {
                // Build CSV rows with only not-found URLs
                const rows = [["URL", "Status"]];
                for (const r of notFound) {
                    rows.push([r.input, "Not Found"]);
                }

                if (notFound.length === 0) {
                    alert("No 'Not Found' URLs to export.");
                    return;
                }

                // Convert to CSV string with UTF-8 BOM for Excel
                const csvContent = rows
                    .map((r) => r.map((cell) => `"${cell}"`).join(","))
                    .join("\n");

                const blob = new Blob(["\uFEFF" + csvContent], {
                    type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "not_found_urls.csv";
                a.click();
                URL.revokeObjectURL(url);
            });

            // Insert export button right after result box
            searchResultEl.insertAdjacentElement("afterend", exportBtn);
        }

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
        uploadStatus.textContent = `Upload Status: ${successCount} Upload, ${errorCount} Exist.`;
        uploadStatus.className = "status error";
    } else {
        uploadStatus.textContent = `Upload OK! ${successCount} file(s) uploaded.`;
        uploadStatus.className = "status success";
    }
});

// --- 2. Download by filename (only file name, force download + page reload) ---
document.getElementById("downloadBtn").addEventListener("click", async () => {
    const filePathInput = document.getElementById("filePathInput");
    const raw = filePathInput.value;

    // Split by lines, trim each line
    const lines = raw
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    if (lines.length === 0) {
        downloadStatus.textContent = "Please enter at least one URL, one per line.";
        downloadStatus.className = "status error";
        return;
    }

    downloadStatus.textContent = "Preparing ZIP, please wait...";
    downloadStatus.className = "status";

    try {
        const zip = new JSZip();
        let successCount = 0;
        let failCount = 0;

        for (const url of lines) {
            // 1) normalize URL: remove protocol and trailing slash
            let cleaned = url
                .replace(/^https?:\/\//i, "") // remove http:// or https://
                .replace(/\/+$/i, "");        // remove trailing /

            if (!cleaned) {
                failCount++;
                continue;
            }

            // 2) build filename used in Supabase (adjust if your pattern differs)
            const fileNameOnStorage = `${cleaned}.mp4`;        // e.g. 20370.rajaluckme.com.mp4
            const filePath = `uploads/${fileNameOnStorage}`;   // e.g. uploads/20370.rajaluckme.com.mp4

            // 3) get public URL from Supabase
            const { data, error } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            if (error) {
                console.error("Failed to get URL for", filePath, error);
                failCount++;
                continue;
            }

            const downloadUrl = data.publicUrl;

            // 4) fetch file
            const res = await fetch(downloadUrl);
            if (!res.ok) {
                console.error("Failed to fetch", filePath, res.status, res.statusText);
                failCount++;
                continue;
            }

            const blob = await res.blob();

            // 5) add to ZIP with clear name (e.g., original domain)
            zip.file(fileNameOnStorage, blob);
            successCount++;
        }

        if (successCount === 0) {
            downloadStatus.textContent = "No files could be added to ZIP. Check URLs or filenames.";
            downloadStatus.className = "status error";
            return;
        }

        // 6) build ZIP name Video_YYYY-MM-DD.zip
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const zipName = `Video_${yyyy}-${mm}-${dd}.zip`;

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, zipName);

        downloadStatus.textContent = `ZIP download started (${successCount} file(s), ${failCount} failed).`;
        downloadStatus.className = "status success";

        setTimeout(() => window.location.reload(), 800);
    } catch (err) {
        console.error(err);
        downloadStatus.textContent = "Download error: " + err.message;
        downloadStatus.className = "status error";
    }
});

document.getElementById("renameSearchBtn").addEventListener("click", async () => {
    const searchInput = document.getElementById("renameSearchInput");
    const resultEl = document.getElementById("renameSearchResult");

    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
        resultEl.innerHTML = "Please enter a filename to search.";
        resultEl.style.display = "block";
        return;
    }

    resultEl.innerHTML = "Searching...";
    resultEl.style.display = "block";

    try {
        // Load all files from bucket
        const { data: allFiles, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list("uploads/", { limit: 10000 });

        if (error) {
            resultEl.innerHTML = "Search failed: " + error.message;
            return;
        }

        // Filter files matching the query
        const matched = allFiles.filter((f) =>
            f.name.toLowerCase().includes(query)
        );

        if (matched.length === 0) {
            resultEl.innerHTML = "No files found matching <strong>" + query + "</strong>.";
            return;
        }

        // Build result list with inline rename input for each match
        let html = `<strong>${matched.length} file(s) found:</strong><br><br>`;

        matched.forEach((file, index) => {
            const nameWithoutExt = file.name.replace(/\.mp4$/i, "");
            html += `
                <div id="renameRow_${index}" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 10px;
                    flex-wrap: wrap;
                ">
                    <span style="
                        flex: 1;
                        min-width: 180px;
                        font-size: 0.9rem;
                        color: #333;
                        word-break: break-all;
                    ">${file.name}</span>

                    <input
                        type="text"
                        id="newName_${index}"
                        value="${nameWithoutExt}"
                        style="
                            flex: 1;
                            min-width: 180px;
                            padding: 6px 10px;
                            border: 1px solid #dee2e6;
                            border-radius: 6px;
                            font-size: 0.9rem;
                        "
                    />

                    <button
                        onclick="renameFile('${file.name}', ${index})"
                        style="
                            padding: 6px 14px;
                            background: #0d6efd;
                            color: #fff;
                            border: none;
                            border-radius: 6px;
                            font-size: 0.9rem;
                            cursor: pointer;
                            white-space: nowrap;
                        "
                    >Rename</button>

                    <span id="renameStatus_${index}" style="font-size:0.85rem;"></span>
                </div>
            `;
        });

        resultEl.innerHTML = html;
        resultEl.style.cssText = `
            display: block;
            max-height: 350px;
            overflow-y: auto;
            padding: 12px 16px;
            background: #f8f9fa;
            border-radius: 6px;
        `;

    } catch (err) {
        resultEl.innerHTML = "Search error: " + err.message;
        resultEl.style.display = "block";
    }
});


// Rename handler — called inline from each row's button
document.getElementById("renameSearchBtn").addEventListener("click", async () => {
    const searchInput = document.getElementById("renameSearchInput");
    const resultEl = document.getElementById("renameSearchResult");

    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
        resultEl.innerHTML = "Please enter a filename to search.";
        resultEl.style.display = "block";
        return;
    }

    resultEl.innerHTML = "Searching...";
    resultEl.style.display = "block";

    try {
        const { data: allFiles, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list("uploads/", { limit: 10000 });

        if (error) {
            resultEl.innerHTML = "Search failed: " + error.message;
            return;
        }

        const matched = allFiles.filter((f) =>
            f.name.toLowerCase().includes(query)
        );

        if (matched.length === 0) {
            resultEl.innerHTML = "No files found matching <strong>" + query + "</strong>.";
            return;
        }

        let html = `<strong>${matched.length} file(s) found:</strong><br><br>`;

        matched.forEach((file, index) => {
            const nameWithoutExt = file.name.replace(/\.mp4$/i, "");
            html += `
                <div id="renameRow_${index}" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 10px;
                    flex-wrap: wrap;
                ">
                    <span style="
                        flex: 1;
                        min-width: 180px;
                        font-size: 0.9rem;
                        color: #333;
                        word-break: break-all;
                    ">${file.name}</span>

                    <input
                        type="text"
                        id="newName_${index}"
                        value="${nameWithoutExt}"
                        style="
                            flex: 1;
                            min-width: 180px;
                            padding: 6px 10px;
                            border: 1px solid #dee2e6;
                            border-radius: 6px;
                            font-size: 0.9rem;
                        "
                    />

                    <button
                        onclick="renameFile('${file.name}', ${index})"
                        style="
                            padding: 6px 14px;
                            background: #0d6efd;
                            color: #fff;
                            border: none;
                            border-radius: 6px;
                            font-size: 0.9rem;
                            cursor: pointer;
                            white-space: nowrap;
                        "
                    >Rename</button>

                    <span id="renameStatus_${index}" style="font-size:0.85rem;"></span>
                </div>
            `;
        });

        resultEl.innerHTML = html;
        resultEl.style.cssText = `
            display: block;
            max-height: 350px;
            overflow-y: auto;
            padding: 12px 16px;
            background: #f8f9fa;
            border-radius: 6px;
        `;

    } catch (err) {
        resultEl.innerHTML = "Search error: " + err.message;
        resultEl.style.display = "block";
    }
});


// ✅ Attached to window so inline onclick can find it
window.renameFile = async function (oldFileName, index) {
    const newNameInput = document.getElementById(`newName_${index}`);
    const statusEl = document.getElementById(`renameStatus_${index}`);

    const newName = newNameInput.value.trim();

    if (!newName) {
        statusEl.style.color = "red";
        statusEl.textContent = "⚠ Name cannot be empty.";
        return;
    }

    const newFileName = newName.endsWith(".mp4") ? newName : newName + ".mp4";

    if (newFileName === oldFileName) {
        statusEl.style.color = "orange";
        statusEl.textContent = "⚠ Name is the same.";
        return;
    }

    statusEl.style.color = "#555";
    statusEl.textContent = "Renaming...";

    try {
        const oldPath = `uploads/${oldFileName}`;
        const newPath = `uploads/${newFileName}`;

        // Step 1: Copy to new name
        const { error: copyError } = await supabase.storage
            .from(BUCKET_NAME)
            .copy(oldPath, newPath);

        if (copyError) {
            statusEl.style.color = "red";
            statusEl.textContent = "✗ Copy failed: " + copyError.message;
            return;
        }

        // Step 2: Delete old file
        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([oldPath]);

        if (deleteError) {
            statusEl.style.color = "orange";
            statusEl.textContent = "✗ Copied but delete failed: " + deleteError.message;
            return;
        }

        // Success — update row so further renames work correctly
        statusEl.style.color = "green";
        statusEl.textContent = "✓ Renamed successfully!";

        const row = document.getElementById(`renameRow_${index}`);
        row.querySelector("span").textContent = newFileName;
        row.querySelector("button").setAttribute("onclick", `renameFile('${newFileName}', ${index})`);

    } catch (err) {
        statusEl.style.color = "red";
        statusEl.textContent = "✗ Error: " + err.message;
    }
};

// Load stats when page loads
loadStats();
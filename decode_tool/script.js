const removeColumns = ['Video-File','Start Time (s)', 'End Time (s)', 'Duration (s)', 'Crop X', 'Crop Y', 'Crop Width', 'Crop Height', 'Created At']; // Cột không mong muốn

document.getElementById('processBtn').addEventListener('click', async () => {
  const input = document.getElementById('csvFiles');
  if (!input.files.length) {
    alert("Vui lòng chọn ít nhất một file CSV!");
    return;
  }

  const mergedData = [];

  for (let file of input.files) {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: "string" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    const cleaned = json.map(row => {
      removeColumns.forEach(col => delete row[col]);
      return row;
    });

    cleaned.forEach((row, i) => {
      if (!mergedData[i]) mergedData[i] = {};
      Object.assign(mergedData[i], row);
    });
  }

  const ws = XLSX.utils.json_to_sheet(mergedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Merged");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });

  const link = document.getElementById("downloadLink");
  link.href = URL.createObjectURL(blob);
  link.style.display = "inline";
});

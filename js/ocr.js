const MAX_PDF_PAGES = 30;

function recognizeImage(image, onProgress) {
  return Tesseract.recognize(image, "eng", {
    logger(message) {
      if (message.status === "recognizing text" && onProgress) {
        onProgress(Math.round(message.progress * 100));
      }
    }
  }).then((result) => result.data.text.trim());
}

export async function extractTextFromFile(file, onProgress = () => {}) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return recognizeImage(file, onProgress);
  }

  if (!globalThis.pdfjsLib) {
    throw new Error("PDF support did not load. Refresh the page and try again.");
  }

  const pdfjs = globalThis.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  if (pdfDocument.numPages > MAX_PDF_PAGES) {
    throw new Error(`PDFs can contain up to ${MAX_PDF_PAGES} pages.`);
  }

  const pages = [];
  let nativeTextPages = 0;
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();

    if (pageText) {
      nativeTextPages += 1;
      pages.push(pageText);
      onProgress(Math.round((pageNumber / pdfDocument.numPages) * 100));
      continue;
    }

    const viewport = page.getViewport({ scale: 2 });
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this PDF page for OCR.");
    await page.render({ canvasContext: context, viewport }).promise;

    const text = await recognizeImage(canvas, (percent) => {
      const progress = ((pageNumber - 1 + percent / 100) / pdfDocument.numPages) * 100;
      onProgress(Math.round(progress));
    });
    pages.push(text);
  }

  if (nativeTextPages) {
    onProgress(100);
  }
  return pages.filter(Boolean).join("\n\n");
}

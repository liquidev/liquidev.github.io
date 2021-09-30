function addHeaderAnchors() {
   const selector = ["h1", "h2", "h3", "h4", "h5", "h6"]
      .map(h => `.content ${h}:not([class])`)
      .join(", ")
   const headers = document.querySelectorAll(selector)

   for (const header of headers) {
      const anchor = document.createElement("a")
      anchor.href = '#' + header.id
      anchor.innerText = header.innerText
      header.innerHTML = anchor.outerHTML
   }
}

addEventListener("load", () => {
   addHeaderAnchors()
})

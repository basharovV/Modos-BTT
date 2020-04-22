export const loadJSON = (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            var xobj = new XMLHttpRequest();
            xobj.overrideMimeType("application/json");
            xobj.open('GET', filePath, true);
            xobj.onreadystatechange = function () {
                if (xobj.readyState == 4) {
                    resolve(xobj.responseText);
                }
            };
            xobj.send(null);
        } catch(e) {
            reject(e);
        }
    })
}

function usernameChanged() {
    document.getElementById("password").value = "password12345";
}

function newTransaction() {
    var myForm = document.getElementById("newTransactionForm");
    var XHR = new XMLHttpRequest();
    var FD = new FormData(myForm);
    XHR.open("POST", "/transaction");
    XHR.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    XHR.send(urlencodeFormData(FD));
}

function newApplication() {
    var myForm = document.getElementById("newApplicationForm");
    var XHR = new XMLHttpRequest();
    var FD = new FormData(myForm);
    XHR.open("POST", "/application");
    XHR.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    XHR.send(urlencodeFormData(FD));
}

function urlencodeFormData(fd) {
    var s = "";
    function encode(s) {
        return encodeURIComponent(s).replace(/%20/g, "+");
    }
    for (var pair of fd.entries()) {
        if (typeof pair[1] == "string") {
            s += (s ? "&" : "") + encode(pair[0]) + "=" + encode(pair[1]);
        }
    }
    return s;
}

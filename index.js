const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const pg = require("pg");
const path = require("path");
const url = require("url");
const formatCurrency = require("format-currency");
const PORT = process.env.PORT || 5000;
const connectionString =
    process.env.DATABASE_URL || "postgres://xixecnyvxikojr:74604844ba9a928bfd12c3d81d5e23df1cb4f92898b942e18dea2cd751b740b8@ec2-107-21-126-193.compute-1.amazonaws.com:5432/du5350tab150u";
const config = getDBconfigFromString(connectionString);
const pool = new pg.Pool(config);
const jsforce = require("jsforce");
const conn = new jsforce.Connection();

var app = new express()
    .use(express.static(path.join(__dirname, "public")))
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(cookieParser())
    .set("views", path.join(__dirname, "views"))
    .set("view engine", "ejs");

app.get("/", function(request, response) {
    response.render("pages/index", newViewState());
});

app.post("/", function(request, response) {
    var viewState = newViewState();
    viewState.username = request.body.username;
    viewState.password = request.body.password;
    if (viewState.username == null) {
        response.render("pages/index", viewState);
    } else {
        getAccountByUsername(viewState.username, function(account) {
            if (account == null) {
                response.render("pages/index", viewState);
            } else {
                response.cookie("accountId", account.sfid);
                response.cookie("creditScore", account.credit_score__c);
                response.cookie("username", viewState.username);
                response.redirect("/dashboard");
            }
        });
    }
});

app.get("/dashboard", function(request, response) {
    var viewState = newViewState();
    viewState.accountId = request.cookies.accountId;
    if (viewState.accountId == null) {
        reponse.send("No Account ID");
        return;
    }
    viewState.creditScore = request.cookies.creditScore;
    viewState.username = request.cookies.username;
    viewState.usernameFound = true;

    getBankAccountsForAccountID(viewState.accountId, function(bankAccounts) {
        viewState.bankAccounts = bankAccounts;
        viewState.bankAccounts.forEach(function(bankAccount) {
            viewState.total = viewState.total + bankAccount.balance__c;
        });

        getLatestOpportunityForAccountID(viewState.accountId, function(opportunity) {
            viewState.opportunity = opportunity;
            response.render("pages/dashboard", viewState);
        });
    });
});

app.post("/transaction", function(request, response) {
    var bankAccountID = request.body.bankAccountID;
    var description = request.body.description;
    var amount = request.body.amount;
    createBankTransactionEvent(bankAccountID, description, amount);
});

app.post("/application", function(request, response) {
    var accountId = request.cookies.accountId;
    var monthlyHousingPayment = request.body.monthlyHousingPayment;
    var loanAmount = request.body.loanAmount;
    var loanTerms = request.body.loanTerms;
    createLoanApplication(accountId, monthlyHousingPayment, loanAmount, loanTerms);
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

function getAccountByUsername(username, callbackFunction) {
    pool.connect(function(err, client, done) {
        if (err) {
            console.log("Can not connect to the DB" + err);
            callbackFunction(null);
            return;
        }
        var query = {
            name: "fetch-username",
            text: "SELECT sfid, username__c, credit_score__c FROM salesforce.Account WHERE username__c = $1",
            values: [username]
        };
        client.query(query, function(err, result) {
            done();
            if (err) {
                console.log(err);
                callbackFunction();
                return;
            }
            if (result.rowCount > 0) {
                callbackFunction(result.rows[0]);
            } else {
                callbackFunction();
            }
            return;
        });
    });
}

function getBankAccountsForAccountID(accountID, callbackFunction) {
    pool.connect(function(err, client, done) {
        if (err) {
            console.log("Can not connect to the DB" + err);
            callbackFunction(null);
            return;
        }
        var query = {
            name: "fetch-bank-accounts",
            text:
                "SELECT " +
                "salesforce.BankAccount__c.sfid," +
                "salesforce.BankAccount__c.name, " +
                "salesforce.BankAccount__c.description__c, " +
                "salesforce.BankAccount__c.balance__c, " +
                "salesforce.Transaction__c.description__c AS TransactionDescription, " +
                "salesforce.Transaction__c.amount__c, " +
                "salesforce.Transaction__c.CreatedDate " +
                "FROM salesforce.BankAccount__c " +
                "LEFT OUTER JOIN salesforce.Transaction__c ON (salesforce.BankAccount__c.last_transaction__c = salesforce.Transaction__c.sfid) " +
                "WHERE account__c = $1 " +
                "ORDER BY salesforce.BankAccount__c.Name ASC",
            values: [accountID]
        };
        client.query(query, function(err, result) {
            done();
            if (err) {
                console.log(err);
                callbackFunction();
                return;
            }
            if (result.rowCount > 0) {
                console.log(result.rows);
                callbackFunction(result.rows);
            } else {
                callbackFunction();
            }
            return;
        });
    });
}

function getLatestOpportunityForAccountID(accountID, callbackFunction) {
    pool.connect(function(err, client, done) {
        if (err) {
            console.log("Can not connect to the DB" + err);
            callbackFunction(null);
            return;
        }
        var query = {
            name: "fetch-opportunity",
            text: "SELECT salesforce.Opportunity.Name, salesforce.Opportunity.StageName FROM salesforce.Opportunity WHERE accountid = $1 LIMIT 1",
            values: [accountID]
        };
        client.query(query, function(err, result) {
            done();
            if (err) {
                console.log(err);
                callbackFunction();
                return;
            }
            if (result.rowCount > 0) {
                console.log(result.rows[0]);
                callbackFunction(result.rows[0]);
            } else {
                callbackFunction();
            }
            return;
        });
    });
}

function newViewState() {
    return {
        accountId: null,
        account: null,
        creditScore: null,
        username: null,
        password: null,
        usernameFound: false,
        account: null,
        opportunity: null,
        bankAccounts: [],
        total: null,
        formatCurrency: formatCurrency,
        shortDate: shortDate
    };
}

function createBankTransactionEvent(bankAccountID, description, amount) {
    conn.login("gsumner@websterbank.demo", "salesforce1", function(err, res) {
        if (err) {
            return console.error(err);
        }
        conn.sobject("Bank_Transaction__e").create(
            {
                Bank_Account_ID__c: bankAccountID,
                Description__c: description,
                Amount__c: amount
            },
            function(err, ret) {
                if (err || !ret.success) {
                    return console.error(err, ret);
                }
                console.log("Created Event ID: " + ret.id + "\n{" + "'BankAccountID': '" + bankAccountID + "', " + "'Description': '" + description + "', " + "'Amount': '" + amount + "'}");
            }
        );
    });
}

function createLoanApplication(accountID, monthlyHousingPayment, loanAmount, loanTerms) {
    conn.login("gsumner@websterbank.demo", "salesforce1", function(err, res) {
        if (err) {
            return console.error(err);
        }
        var values = {
            Account__c: accountID,
            Loan_Amount__c: loanAmount,
            Terms__c: loanTerms,
            Status__c: "Review"
        };
        conn.sobject("LoanApplication__c").create(values, function(err, ret) {
            if (err || !ret.success) {
                return console.error(err, ret);
            }
            console.log("Created Loan Application ID: " + ret.id + " " + JSON.stringify(values));
        });
    });
}

function shortDate(dateString) {
    var d = new Date(dateString);
    var month = d.getMonth();
    var year = d
        .getFullYear()
        .toString()
        .substr(2, 2);
    return month + "/" + year;
}

function getDBconfigFromString(connectionString) {
    const params = url.parse(connectionString);
    const auth = params.auth.split(":");

    const config = {
        user: auth[0],
        password: auth[1],
        host: params.hostname,
        port: params.port,
        database: params.pathname.split("/")[1],
        ssl: true
    };
    return config;
}

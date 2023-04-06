const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
module.exports = app;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
console.log(dbPath);

let db;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at port 3000");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertStateTable = (anObject) => {
  return {
    stateId: anObject.state_id,
    stateName: anObject.state_name,
    population: anObject.population,
  };
};

const convertDistrictTable = (anObject) => {
  return {
    districtId: anObject.district_id,
    districtName: anObject.district_name,
    stateId: anObject.state_id,
    cases: anObject.cases,
    cured: anObject.cured,
    active: anObject.active,
    deaths: anObject.deaths,
  };
};

//API_1 Login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const dbQuery = `
                SELECT * 
                FROM user
                WHERE username = '${username}';`;
  const isUserPresent = await db.get(dbQuery);
  if (isUserPresent === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const verifyPassword = await bcrypt.compare(
      password,
      isUserPresent.password
    );
    console.log(verifyPassword);
    if (verifyPassword === false) {
      response.status(400);
      response.send("Invalid Password");
    } else {
      const payload = username;
      const token = jwt.sign(payload, "abcdefg");
      response.send({ token });
    }
  }
});

const validatingToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Token");
  } else {
    jwt.verify(jwtToken, "abcdefg", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API_2 accessing database

app.get("/states/", validatingToken, async (request, response) => {
  const dbQuery = `
                SELECT * 
                FROM state;`;
  const stateArray = await db.all(dbQuery);
  const reqArray = stateArray.map((each) => convertStateTable(each));
  response.send(reqArray);
});

//API_3 accessing database

app.get("/states/:stateId", validatingToken, async (request, response) => {
  const { stateId } = request.params;
  const dbQuery = `
                SELECT * 
                FROM state
                WHERE state_id = ${stateId};`;
  const stateArray = await db.get(dbQuery);
  const reqState = convertStateTable(stateArray);
  response.send(reqState);
});

//API_4 inserting into database

app.post("/districts/", validatingToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  console.log(districtName);
  const dbQuery = `
                INSERT INTO 
                    district (
                        district_name,
                        state_id,
                        cases,
                        cured,
                        active,
                        deaths)
                    VALUES (
                        '${districtName}',
                        ${stateId},
                        ${cases},
                        ${cured},
                        ${active},
                        ${deaths}
                    );
                `;
  const inserted = await db.run(dbQuery);
  //const reqState = convertStateTable(stateArray);
  response.send("District successfully added");
});

//API_5 accessing database

app.get(
  "/districts/:districtId",
  validatingToken,
  async (request, response) => {
    const { districtId } = request.params;
    console.log(districtId);
    const dbQuery = `
                SELECT * 
                FROM district
                WHERE district_id = ${districtId};`;
    const district = await db.get(dbQuery);
    const reqDistrict = convertDistrictTable(district);
    response.send(reqDistrict);
  }
);

//API_6 deleting database

app.delete(
  "/districts/:districtId",
  validatingToken,
  async (request, response) => {
    const { districtId } = request.params;
    console.log(districtId);
    const dbQuery = `
                DELETE
                FROM district
                WHERE district_id = ${districtId};`;
    const district = await db.get(dbQuery);
    //const reqDistrict = convertDistrictTable(district);
    response.send("District Removed");
  }
);

//API_7 updating database

app.put(
  "/districts/:districtId",
  validatingToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const dbQuery = `
                UPDATE district
                SET 
                    district_name = '${districtName}',
                    state_id = '${stateId}',
                    cases = '${cases}',
                    cured = '${cured}',
                    active = '${active}',
                    deaths = '${deaths}'
                WHERE 
                    district_id = ${districtId};    
                `;
    const updated = await db.run(dbQuery);
    //const reqState = convertStateTable(stateArray);
    response.send("District Details Updated ");
  }
);

//API_8 accessing stats

app.get(
  "/states/:stateId/stats",
  validatingToken,
  async (request, response) => {
    const { stateId } = request.params;
    const dbQuery = `
                SELECT 
                    SUM(cases) AS totalCases,
                    SUM(cured) AS totalCured,
                    SUM(active) AS totalActive,
                    SUM(deaths) AS totalDeaths
                FROM district
                WHERE state_id = ${stateId};`;
    const districtStats = await db.get(dbQuery);
    response.send(districtStats);
  }
);

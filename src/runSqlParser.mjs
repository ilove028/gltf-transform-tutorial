import sequelizePkg, { json } from "sequelize";
import pkg from "node-sql-parser";

const { Parser } = pkg;
const { Sequelize, DataTypes } = sequelizePkg;
const parser = new Parser();
// const res = parser.parse("Select * from t");


const sequelize = new Sequelize("sqlite::memory:");
const createUser = (context) => sequelize.define("User", {
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING
  },
  age: {
    type: DataTypes.INET,
    allowNull: false
  }
},
{
  freezeTableName: true,
  timestamps: false,
  validate: {
    hasAuthorization() {
      // throw new Error("You don't have authorization.")
    }
  }
});

const checkAuthorication = (context, sql) => {
  let { tableList, columnList } = parser.parse(sql);
  tableList = tableList.map((table) => {
    const matchs = /^(.*)::(.*)::(.*)$/.exec(table);

    if (matchs) {
      return {
        type: matchs[1],
        dbName: matchs[2],
        tableName: matchs[3],
        columnName: null
      }
    } else {
      throw new Error(`Parse sql ${sql} @ ${table} table failed.`)
    }
  });
  columnList = columnList.map((column) => {
    const matchs = /^(.*)::(.*)::(.*)$/.exec(column);

    if (matchs) {
      return {
        type: matchs[1],
        dbName: null,
        tableName: tableList.length === 1 ? tableList[0].tableName : matchs[2],
        columnName: matchs[3]
      }
    } else {
      throw new Error(`Parse sql ${sql} @ ${column} column failed.`)
    }
  });
  // if (context) {
  //   throw new Error(`You don't has ${res} access.`)
  // }
  columnList.forEach(({ type, tableName, columnName }) => {
    const operations = context.get(`${tableName}/${columnName}`);

    if (!operations || !operations[type]) {
      throw new Error(`You don't has ${tableName}/${columnName}#${type} authorization.`)
    }
  })
}

const sqlQuery = async (context, sql) => {
  checkAuthorication(context, sql);
  return await sequelize.query(sql);
} 

(async () => {
  const User = createUser()
  await sequelize.authenticate();
  console.log('Connection has been established successfully.');
  await sequelize.sync();
  console.log("All models were synchronized successfully.");
  const jane = User.build({ firstName: "Jane", age: 10 });
  console.log(jane.firstName, jane.lastName);
  await jane.save();
  console.log(((await jane.increment("age", { by: 5 }))).toJSON());
  console.log((await jane.reload()).toJSON());

  const users = await User.findAll({
    attributes: {
      include: [
        [sequelize.fn("SUM", sequelize.col("age")), "totalAge"]
      ]
    }
  });

  console.log(users[0].getDataValue("totalAge"));

  await User.bulkCreate([
    { firstName: "A", age: 2 },
    { firstName: "B", age :18 }
  ])


  // const sql = "SELECT * FROM User";
  // checkAuthorication({ tables: ["User"] }, sql);
  // const results = await sequelize.query(sql, { model: User });

  const [result] = await sqlQuery(new Map([
    ["User/firstName", { select: true, create: false, update: false, delete: false }],
    ["User/lastName", { select: true, create: false, update: false, delete: false }],
    ["User/age", { select: true, create: false, update: false, delete: false }]
  ]), "SELECT firstName, lastName as total FROM User");

  console.log(JSON.stringify(result));
})()
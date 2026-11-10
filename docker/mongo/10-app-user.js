// Infrastructure bootstrap only: creates a least-privilege application user, no collections.
const content = db.getSiblingDB(process.env.MONGO_DATABASE);
content.createUser({
  user: process.env.MONGO_USER,
  pwd: process.env.MONGO_PASSWORD,
  roles: [{ role: "readWrite", db: process.env.MONGO_DATABASE }],
});

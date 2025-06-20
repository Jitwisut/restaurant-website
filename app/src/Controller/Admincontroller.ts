import { Context } from 'elysia'
import { Database } from 'bun:sqlite'
import bcryptjs from 'bcryptjs';
const db = new Database('user.sqlite');
export const Admincontroller = {
  getalluser: async ({ set }: Context) => {
    try {
      let usersRaw = db.query("SELECT * FROM user").all()

      // ตรวจสอบความถูกต้องก่อนใช้
      if (!Array.isArray(usersRaw)) {
        throw new Error("Query result is not an array")
      }

      const users = usersRaw as { role: string }[]
      const total = users.length

      const roles = users.reduce((acc: Record<string, number>, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1
        return acc
      }, {})

      set.status = 200
      return {
        user: users,
        count: total,
        roles
      }

    } catch (error) {
      console.error("Backend error:", (error as Error).message)
      set.status = 500
      return { message: "เกิดข้อผิดพลาด", detail: (error as Error).message }
    }
  },
  updateuser: async ({ set, body }: { set: Context['set'], body: { username: string, email: string, role: string, originuser: string } }) => {
    try {
      const { originuser, username, email, role } = body
      console.log("usernameorigin", originuser)

      const query = "UPDATE user SET username=?, email=?, role=? WHERE username=?"
      const result = db.prepare(query).run(username, email, role, originuser)


      set.status = 200
      return { message: `Success update user ${username}` }
    } catch (error) {
      set.status = 500
      return { message: (error as Error).message }
    }
  },
  createuser: async ({ set, body }: { set: Context['set'], body: { username: string, email: string, password: string, role: string } }) => {
    if (!body.username || !body.email || !body.password || !body.role) {
      set.status = 400
      return { message: "Please fill all field" }
    }
    try {
      let query = "SELECT * FROM user WHERE username=?"
      const user = db.prepare(query).get(body.username)
      if (user) {
        set.status = 400
        return { message: "Username already exist" }
      }
      const hashpass = await bcryptjs.hash(body.password, 10)
      query = "INSERT INTO user (username,email,password,role) VALUES (?,?,?,?)"
      db.prepare(query).run(body.username, body.email, hashpass, body.role)
      set.status = 201
      return { message: "Success create user" }
    } catch (error) {
      set.status = 500
      return { message: (error as Error).message }
    }
  }
}
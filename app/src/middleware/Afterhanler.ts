import {Elysia} from 'elysia'
import {Store} from '../Controller/Profilecontroller'
export const afterhanlerUser=async ({store,jwt,set,cookie}:any)=>{
  const token=cookie.auth.value;
  if(!token){
    console.warn("No token in cookie, skipping afterHandle")
    
    return  // ✅ อย่า return ค่าใด ๆ → ให้ใช้ผลลัพธ์จาก handler เดิม

  }
  const decode=await jwt.verify(token)
  //เก็บค่า decode ไว้ใน store เพื่อนำไปใช้ในหน้าอื่น
  store.decode={decode}
  //ห้าม return ค่าใดๆ เพราะจะทำให้มันถูกใช้งานแทน signin
  /*if(decode.role==="admin"){
    set.status=200
    return {message:"Success: You are admin",link:"/admin"}
  }else if(decode.role==="user"){
    set.status=200
    return {message:"Success: You are user",link:"/user"}
  }else if(decode.role==="kitchen"){
    set.status=200
    return {message:"SUccess: You are kitchen",link:"/kitchen"}
  }
 */ 
}

import bcryptjs from 'bcryptjs';

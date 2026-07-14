import dotenv from 'dotenv'
dotenv.config()

import admin from '../config/firebase.js'

console.log(
   admin.app().name
)
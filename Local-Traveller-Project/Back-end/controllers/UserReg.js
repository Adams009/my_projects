import argon2 from 'argon2'
// import mongoose from 'mongoose';

import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';


const registerController = async (req, res) => {
    // const session = await mongoose.startSession()
    // session.startTransaction()
    try {
        // collect all necessary datas from request body
    const {username, password, email, firstName, lastName, dob, phoneNumber, country } = req.body

    // check if username or email is in use
    const checkExists = User.findOne({ 
        $or : [{ username : username  } , 
            {email: email }]
        })
    
    // send a response if username or email is in use
    if (checkExists.username === username) {
        return res.status(409).json({
            status : 409,
            message : ` ${username} already in use, use another username`
        })
    } else if (checkExists.email === email) {
        return res.status(409).json({
            status : 409,
            message : ` ${email} already in use, use another email`
        })
    }

    // hash password
    const hashedPassword = await argon2.hash(password)

    // create a new user
    const newUser = new User({
        username,
        email,
        password : hashedPassword
    })

    // save the new user
    // await newUser.save({session})
    await newUser.save()

    // create a new profile
    const newProfile = {
        firstName,
        lastName,
        dateOfBirth : dob,
        phoneNumber : [phoneNumber],
        location : {
            country : country
        },
        user : newUser._id
    }

    const userProfile = new UserProfile(newProfile)

    // save the new profile
    // await newProfile.save({session})
    await userProfile.save()

    // update user with the new profile id to the user
    newUser.userProfile = userProfile._id
    // await newUser.save({session})
    await newUser.save()
    
    // commit the transaction
    // await session.commitTransaction()
    // end the session
    // session.endSession()

    // send a response if user and profile are created successfully
    if (newUser && newProfile) {
        res.status(201).json({
            status : 201,
            message : 'User Created Successfully',
            data : {
                username,
                email,
                firstName,
                lastName,
                
            }
        })
    } else {
        res.status(500).json({
            status : 500,
            message : 'Something went wrong, please try again later'
        })
    }
    } catch (err) {
        res.status(500).json({message : err.message})
    }
}

export default registerController;
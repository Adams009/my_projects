import mongoose from 'mongoose'

const UserProfile = new mongoose.Schema({
    firstName : {
        type : 'string',
        required : [true, 'firstName is required'],
        trim : true,
    },

    lastName : {
        type : 'string',
        required : [true, 'lastName is required'],
        trim : true,
    },

    middleName : {
        type : 'String',
        trim : true,
    },

    dateOfBirth : {
        type : Date,
        required : [true, 'Date of Birth is Required'],
    },

    phoneNumber : {
            type : [Number],
            required : [true, 'Phone Number is Required'],
            unique : true,
    },

    bio : {
        type : 'String'
    },

    profilePicture : [
        {
            imageUrl : {
                type : String,
                required : [true, 'Image URL is Required'],
                default : null //??? need to provide a default url value for it later
            },

            isCurrent : {
                type : Boolean,
                default : false
            },
            
            uploadedAt : {
                type : Date,
                default : () => Date.now()
            },
        }
    ],

    backgroundPicture : {
        type : String,
        default : null //??? need to provide a default url value for it later
    },

    location : {
        country : {
            type : String,
            required : [true, 'Country is Required'],
            trim : true,
        },

        state : {
            type : String,
            trim : true,
        },

        city : {
            type : String,
            trim : true,
        },
    },

    currentLocation : {
        type : String,
        default : null, //??? need to provide a default location value for it later

    },

    social : {
        friends : {
            type : [mongoose.Schema.Types.ObjectId],
            default : [],
            ref : 'User',
        },

        followers : {
            type : Number,
            default : 0,
        },

        following : {
            type : Number,
            default : 0,
        }
    },

    preferences : {
        activities : {
            type : [String],
            default : [],
        },

        moods : {
            type : [String],
            default : [],
        }
    },

    travelHistory : {
        type : [String],
        default : [],
    },

    favorites : {
        type : [String],
        default : [],
    },

    notifications : {
        emailAlerts : {
            type : Boolean,
            default : true,
        },

        pushAlerts : {
            type : Boolean,
            default : true,
        }
    },

    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        unique : true,
    }

}, {timestamps: true})

export default mongoose.model("UserProfile", UserProfile)
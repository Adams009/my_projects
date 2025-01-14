import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    username : {
        type : String,
        required : [true, 'Username is Required'],
        trim : true,
        unique : true,
    },

    email : {
        type : String,
        required : [true, 'Email is Required'],
        lowercase : true,
        unique : true,
        trim : true,
    },

    password : {
        type : String,
        required : [true, 'Password is Required'],
    },

    fullName : {
        type : String,
        required : [true, 'Full Name is Required'],
    },

    dateOfBirth : {
        type : Date,
        required : [true, 'Date of Birth is Required'],
    },

    phoneNumber : {
        type : Number,
        required : [true, 'Phone Number is Required'],
        unique : true,
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
                default : Date.now()
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

        currentLocation : {
            type : String,
            default : null //??? need to provide a default location value for it later
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

    // reviews : [
    //     {
    //         placeId : {
    //             type : mongoose.Schema.Types.ObjectId,
    //             ref : 'Place',
    //         },

    //         review : {
    //             type : String,
    //             trim : true,
    //         },

    //         rating : {
    //             type : Number,
    //             trim : true,
    //         },

    //         date : {
    //             type : Date,
    //             default : Date.now(),
    //         },

    //         min : {
    //             type : Number,
    //             default : 1,
    //         },

    //         max : {
    //             type : Number,
    //             default : 5,
    //         }
    //     }
    // ],

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
    accountStatus : {
        type : String,
        enum : ['active', 'inactive', 'suspended'],
        default : 'active',
    },

    timestamps : {
        CreatedAt: {
            type : Date,
            default : Date.now(),
        },

        UpdatedAt : {
            type : Date,
            default : Date.now(),
        },

        LastLogin : {
            type : Date,
            default : null,
        }
    },
})

module.exports = mongoose.model('User', UserSchema);
// subscription : {
//     tier : {
//         type : String,
//         enum : ['free', 'premium', 'pro'],
//         default : 'free',
//     },
//     expirationDate : {
//         type : Date,
//         default : null,
//     },

//     paymentMethod : {
//         type : String,
//         default : null,
//     },

//     billingPeriod : {
//         type : String,
//         enum : ['monthly', 'annually'],
//         default :'monthly',
//     },

//     subscriptionId : {
//         type : String,
//         default : null,
//     },

//     paymentStatus : {
//         type : String,
//         enum : ['active', 'inactive', 'suspended'],
//         default : 'active',
//     },
//     trialPeriod : {
//         type : Boolean,
//         default : false,
//     },
//     trialPeriodStart : {
//         type : Date,
//         default : null,
//     },
//     trialPeriodEnd : {
//         type : Date,
//         default : null,
//     },
//     trialPeriodDaysRemaining : {
//         type : Number,
//         default : 0,
//     },
//     lastPaymentDate : {
//         type : Date,
//         default : null,
//     },
//     lastPaymentAmount : {
//         type : Number,
//         default : null,
//     },
//     lastPaymentCurrency : {
//         type : String,
//         default : null,
//     },
//     lastPaymentMethod : {
//         type : String,
//         default : null,
//     },
// },

// lastPasswordReset : {
//     type : Date,
//     default : Date.now(),
// },
// passwordResetToken : {
//     type : String,
//     default : null,
// },
// passwordResetTokenExpiration : {
//     type : Date,
//     default : null,
// },
// passwordResetAttempts : {
//     type : Number,
//     default : 0,
// },
// passwordResetLocked : {
//     type : Boolean,
//     default : false,
// },
// passwordResetLockedUntil : {
//     type : Date,
//     default : null,
// },
// passwordResetLockedAttempts : {
//     type : Number,
//     default : 0,
// },
// passwordResetLockedAttemptsMax : {
//     type : Number,
//     default : 5,
// },
// passwordResetLockedAttemptsInterval : {
//     type : Number,
//     default : 1,
// },
// passwordResetLockedInterval : {
//     type : Number,
//     default : 5,
// },
// passwordResetLockedIntervalUnit : {
//     type : String,
//     default : 'minutes',
// },
// passwordResetLockedUntilMessage : {
//     type : String,
//     default : null,
// },
// passwordResetLockedUntilMessageDuration : {
//     type : Number,
//     default : 5,
// },
// passwordResetLockedUntilMessageDurationUnit : {
    
//     type : String,
//     default : 'minutes',
// },
// passwordResetLockedUntilMessageDurationUnitPlural : {
//     type : String,
//     default : 'minutes',
// },
// passwordResetLockedUntilMessageDurationUnitSingular : {
//     type : String,
//     default : 'minute',
// },
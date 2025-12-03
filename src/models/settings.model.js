import mongoose, { Schema } from "mongoose";

const SettingsSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create a method to get a setting by key
SettingsSchema.statics.getSetting = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Create a method to set a setting
SettingsSchema.statics.setSetting = async function(key, value, description = '') {
  return await this.findOneAndUpdate(
    { key },
    { key, value, description },
    { upsert: true, new: true }
  );
};

const Settings = mongoose.model('Settings', SettingsSchema);
export default Settings;


import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Profile() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        setName(user.name || "");
        setAge(user.age || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setAddress(user.address || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const saveProfile = async () => {
    try {
      if (age && (isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120)) {
        Alert.alert("Error", "Please enter a valid age");
        return;
      }

      const userData = await AsyncStorage.getItem("userData");
      const existingData = userData ? JSON.parse(userData) : {};
      
      const profileData = {
        ...existingData,
        name,
        age,
        email,
        phone,
        address,
      };
      
      await AsyncStorage.setItem("userData", JSON.stringify(profileData));
      
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to save profile");
      console.error("Error saving profile:", error);
    }
  };

  const getInitials = (fullName) => {
    if (!fullName) return "?";
    const names = fullName.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Dynamically adjust font size based on name length
  const getNameFontSize = (text) => {
    if (!text) return 24;
    if (text.length <= 10) return 24;
    if (text.length <= 20) return 20;
    return 17; // for long names
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBackground}>
          <View style={styles.headerOverlay} />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(name)}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
            </View>
          </View>

          <View style={styles.userInfo}>
      <Text style={[styles.userName, { fontSize: getNameFontSize(name) }]}>
              {name || "Your Name"}
            </Text>
            <Text style={styles.userEmail}>
              {email || "your.email@example.com"}
            </Text>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Personal Details</Text>
              <Text style={styles.sectionSubtitle}>
                {isEditing ? "Update your information" : "Your profile information"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
            >
              <Text style={[styles.editText, { color: isEditing ? "#FF6B6B" : "#9D4EDD" }]}>
                {isEditing ? "Cancel" : "Edit"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields (no icons) */}
          <View style={styles.formContainer}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Full Name</Text>
                {isEditing && <Text style={styles.requiredStar}>*</Text>}
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor="#CBD5E0"
                editable={isEditing}
                style={[styles.input, isEditing && styles.inputActive]}
              />
            </View>

            {/* Age */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                placeholder="Enter your age"
                placeholderTextColor="#CBD5E0"
                keyboardType="numeric"
                editable={isEditing}
                style={[styles.input, isEditing && styles.inputActive]}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Email Address</Text>
                {isEditing && <Text style={styles.requiredStar}>*</Text>}
              </View>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#CBD5E0"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={isEditing}
                style={[styles.input, isEditing && styles.inputActive]}
              />
            </View>

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone number"
                placeholderTextColor="#CBD5E0"
                keyboardType="phone-pad"
                editable={isEditing}
                style={[styles.input, isEditing && styles.inputActive]}
              />
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Enter your address"
                placeholderTextColor="#CBD5E0"
                multiline
                numberOfLines={3}
                editable={isEditing}
                style={[styles.input, styles.inputMultiline, isEditing && styles.inputActive]}
              />
            </View>
          </View>

          {/* Buttons */}
          {isEditing && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={saveProfile}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA"
  },
  scrollView: { 
    flex: 1 

  },
  scrollContent: { 
    paddingBottom: 40 
  },
  headerBackground: {
    height: 180,
    backgroundColor: "#9D4EDD",
    position: "relative"
  },
  headerOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.05)"
  },
  profileCard: {
    marginHorizontal: 20,
    marginTop: -100,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#9D4EDD",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    alignItems: "center"
  },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatarGlow: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#9D4EDD",
    opacity: 0.2,
    top: -5, left: -5
  },
  avatar: {
    width: 100, 
    height: 100, 
    borderRadius: 50,
    backgroundColor: "#9D4EDD",
    justifyContent: "center", 
    alignItems: "center",
    borderWidth: 4, 
    borderColor: "#FFFFFF"
  },
  avatarText: { 
    fontSize: 40, 
    fontWeight: "bold", 
    color: "#FFFFFF" 
  },
  statusBadge: {
    position: "absolute", 
    bottom: 2, 
    right: 2,
    width: 24, 
    height: 24, 
    borderRadius: 12,
    backgroundColor: "#FFFFFF", 
    justifyContent: "center",
    alignItems: "center", 
    borderWidth: 2, 
    borderColor: "#FFFFFF"
  },
  statusDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    backgroundColor: "#10B981" 
  },
  userInfo: { 
    alignItems: "center", 
    marginBottom: 20 
  },
  userName: { 
    fontWeight: "bold", 
    color: "#1A202C", 
    marginBottom: 6 
  },
  userEmail: { 
    fontSize: 14, 
    color: "#718096" 
  },
  infoSection: {
    marginHorizontal: 20, 
    marginTop: 24, 
    backgroundColor: "#FFFFFF",
    borderRadius: 20, 
    padding: 20,
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 3
  },
  sectionHeader: {
    flexDirection: "row", 
    justifyContent: "space-between",
    alignItems: "flex-start", 
    marginBottom: 24,
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: "#F0F0F0"
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: "bold", 
    color: "#1A202C", 
    marginBottom: 4 
  },
  sectionSubtitle: { 
    fontSize: 13, 
    color: "#A0AEC0" 
  },
  editText: { 
    fontSize: 16, 
    fontWeight: "600" 
  },
  formContainer: { 
    gap: 18 
  },
  inputGroup: { 
    marginBottom: 4 
  },
  labelRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 8, 
    gap: 4 
  },
  label: {
    fontSize: 13, 
    fontWeight: "600", 
    color: "#4A5568",
    textTransform: "uppercase", 
    letterSpacing: 0.5
  },
  requiredStar: { 
    color: "#EF4444", 
    fontSize: 14, 
    fontWeight: "bold" },
  input: {
    backgroundColor: "#F8F9FA", borderRadius: 14, borderWidth: 1.5,
    borderColor: "#E2E8F0", paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: "#1A202C",
    fontWeight: "500"
  },
  inputActive: {
    backgroundColor: "#FFFFFF", borderColor: "#9D4EDD",
    shadowColor: "#9D4EDD", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 2
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  buttonContainer: { flexDirection: "row", marginTop: 24 },
  saveButton: {
    flex: 1, backgroundColor: "#9D4EDD",
    paddingVertical: 16, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#9D4EDD", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold", letterSpacing: 0.3 }
});

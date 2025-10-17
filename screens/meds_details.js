import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    Alert,
} from 'react-native';
import { db } from '../services/firebaseConfig'; 
import { doc, deleteDoc } from 'firebase/firestore'; 

export default function MedicineDetails({ navigation, route }) {
    const medicine = route?.params?.medicine;

    if (!medicine) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Medicine not found</Text>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Format time for display (e.g., "12:00 PM")
    const formatTime = (time) => {
        if (!time || !time.includes(':')) return time;
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        // Ensure time is treated as 24-hour clock for calculation
        const ampm = hour >= 12 && hour < 24 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        // Reconstruct time string, assuming input minutes are always 2 digits
        return `${displayHour.toString()}:${minutes} ${ampm}`;
    };

    // Get alert strength display
    const getAlertStrengthDisplay = () => {
        if (!medicine.alertSettings) return 'Normal';
        switch (medicine.alertSettings.alertStrength) {
            case 'gentle': return 'Gentle (Quiet sound only)';
            case 'strong': return 'Strong (Loud sound + vibration)';
            default: return 'Normal (Sound + light vibration)';
        }
    };

    // Get alert type display
    const getAlertTypeDisplay = () => {
        if (!medicine.alertSettings) return 'Phone Only';
        switch (medicine.alertSettings.alertType) {
            case 'watch': return 'Watch Only';
            case 'both': return 'Phone & Watch';
            default: return 'Phone Only';
        }
    };

    // Format start date for display
    const formatDateForDisplay = (isoDateString) => {
        if (!isoDateString) return "N/A";
        const date = new Date(isoDateString);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const handleEdit = () => {
        // Pass the full medicine object to the AddMedicine screen for pre-population
        navigation.navigate('AddMedicine', { medicine: medicine });
    };

    // 🔑 UPDATED: Use Firestore to delete the document
    const handleDelete = async () => {
        Alert.alert(
            "Delete Medicine",
            "Are you sure you want to permanently delete this medicine?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // 1. Get a reference to the Firestore document using the medicine's ID
                            const medRef = doc(db, "medications", medicine.id);
                            
                            // 2. Delete the document
                            await deleteDoc(medRef);

                            // 3. Navigate back to the list (MedicineList will auto-update via its onSnapshot listener)
                            Alert.alert('Success', 'Medicine deleted successfully.', 
                                [{ text: 'OK', onPress: () => navigation.goBack() }]);
                        } catch (error) {
                            console.error('Failed to delete medicine from Firestore:', error);
                            Alert.alert('Error', 'Failed to delete medicine. Please check your network connection.');
                        }
                    }
                }
            ]
        );
    };

    const renderInfoRow = (label, value) => (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.headerText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Medicine Details</Text>
                <TouchableOpacity onPress={handleEdit}>
                    <Text style={styles.headerText}>Edit</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Medicine Summary Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Medicine Summary</Text>
                    <View style={styles.cardContent}>
                        {renderInfoRow('Medicine Name', medicine.name)}
                        {renderInfoRow('Dosage', medicine.dosage)}
                        {renderInfoRow('Frequency', medicine.frequency)}
                        {medicine.days && renderInfoRow('Days', medicine.days)}
                    </View>
                </View>

                {/* Schedule Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Schedule</Text>
                    <View style={styles.cardContent}>
                        {medicine.reminderTimes && medicine.reminderTimes.length > 0 ? (
                            <View style={styles.timesContainer}>
                                <Text style={styles.sectionLabel}>Reminder Times</Text>
                                <View style={styles.timesList}>
                                    {medicine.reminderTimes.map((time, index) => (
                                        <View key={index} style={styles.timeChip}>
                                            <Text style={styles.timeChipText}>{formatTime(time)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.infoText}>No specific reminder times set.</Text>
                        )}
                        {medicine.startDate && renderInfoRow('Start Date', formatDateForDisplay(medicine.startDate))}
                    </View>
                </View>

                {/* Alert Settings Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Alert Settings</Text>
                    <View style={styles.cardContent}>
                        {renderInfoRow('Reminders', medicine.reminderEnabled ? 'Enabled' : 'Disabled')}
                        {medicine.reminderEnabled && (
                            <>
                                {renderInfoRow('Alert Device', getAlertTypeDisplay())}
                                {renderInfoRow('Alert Strength', getAlertStrengthDisplay())}
                                {medicine.alertSettings?.earlyReminder && (
                                    <Text style={styles.featureText}>• Early reminder (5 minutes before)</Text>
                                )}
                                {medicine.alertSettings?.waitOption && (
                                    <Text style={styles.featureText}>• Wait 10 minutes option enabled</Text>
                                )}
                            </>
                        )}
                    </View>
                </View>

                {/* Additional Information Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Additional Information</Text>
                    <View style={styles.cardContent}>
                        {medicine.takeWithFood && (
                            <Text style={styles.infoText}>• Take with food</Text>
                        )}
                        {medicine.specialInstructions ? (
                            <View style={styles.instructionsContainer}>
                                <Text style={styles.sectionLabel}>Special Instructions</Text>
                                <Text style={styles.instructionsText}>{medicine.specialInstructions}</Text>
                            </View>
                        ) : (
                            <Text style={styles.infoText}>No special instructions.</Text>
                        )}
                    </View>
                </View>

                {/* Delete Button */}
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                >
                    <Text style={styles.deleteButtonText}>Delete Medicine</Text>
                </TouchableOpacity>

                <View style={styles.bottomSpacing} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // Container & Layout
    container: {
        flex: 1,
        backgroundColor: '#F0F2F5',
    },
    scrollView: {
        paddingHorizontal: 15,
    },
    bottomSpacing: {
        height: 60,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        paddingTop: 40,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    headerText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
    },

    // Card Components
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginTop: 15,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    cardContent: {
        paddingTop: 5,
    },

    // Info Display
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 16,
        color: '#64748B',
    },
    infoValue: {
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '500',
        flexShrink: 1,
        textAlign: 'right',
    },
    infoText: {
        fontSize: 16,
        color: '#1E293B',
        marginBottom: 8,
    },

    // Section Labels
    sectionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B',
        marginBottom: 8,
    },

    // Time Display
    timesContainer: {
        marginTop: 8,
    },
    timesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    timeChip: {
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    timeChipText: {
        fontSize: 14,
        color: '#1976D2',
        fontWeight: '500',
    },

    // Text Styles
    featureText: {
        fontSize: 16,
        color: '#1E293B',
        marginBottom: 8,
        fontWeight: '400',
    },

    // Instructions
    instructionsContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    instructionsText: {
        fontSize: 16,
        color: '#1E293B',
        lineHeight: 22,
        marginTop: 5,
    },

    // Buttons
    deleteButton: {
        backgroundColor: '#EF4444',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    deleteButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    backButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },

    // Error States
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#666',
        marginBottom: 20,
    },
});
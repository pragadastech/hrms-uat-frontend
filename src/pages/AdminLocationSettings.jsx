import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { locationAPI } from '../services/api';
import toast from 'react-hot-toast';
import { MapPin, Navigation, Map as MapIcon, Save } from 'lucide-react';

export default function AdminLocationSettings() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        officeName: '',
        address: '',
        latitude: '',
        longitude: '',
        radiusKm: 1.0,
        active: true
    });

    const fetchLocation = async () => {
        try {
            setLoading(true);
            const res = await locationAPI.getOfficeLocation();
            if (res.data?.success && res.data?.data) {
                const data = res.data.data;
                setFormData({
                    officeName: data.officeName || '',
                    address: data.address || '',
                    latitude: data.latitude || '',
                    longitude: data.longitude || '',
                    radiusKm: data.radiusKm || 1.0,
                    active: data.active ?? true
                });
            }
        } catch (error) {
            console.error('Error fetching office location:', error);
            // Ignore 400 errors or Not Found if it's just not configured yet
            if (error.response?.status !== 400 && error.response?.status !== 404) {
                toast.error('Failed to load office location settings');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocation();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleGetLocation = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData(prev => ({
                        ...prev,
                        latitude: position.coords.latitude.toFixed(6),
                        longitude: position.coords.longitude.toFixed(6)
                    }));
                    toast.success('Location acquired');
                },
                (error) => {
                    toast.error('Error getting location: ' + error.message);
                },
                { enableHighAccuracy: true }
            );
        } else {
            toast.error("Geolocation is not supported by this browser.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate coordinates
        if (!formData.latitude || !formData.longitude) {
            toast.error('Latitude and longitude are required');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                latitude: Number(formData.latitude),
                longitude: Number(formData.longitude),
                radiusKm: Number(formData.radiusKm)
            };

            const res = await locationAPI.setOfficeLocation(payload);
            if (res.data?.success) {
                toast.success('Office location saved successfully');
                fetchLocation();
            } else {
                toast.error(res.data?.message || 'Failed to save location');
            }
        } catch (error) {
            console.error('Save error:', error);
            toast.error(error.response?.data?.message || 'Failed to save office location');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="main-content flex flex-col h-screen">
            <Header title="Geofencing Location Settings" subtitle="System Settings > Office Location" />

            <div className="page-content flex-1 overflow-y-auto p-6" style={{ background: '#f8fafc' }}>
                <div className="max-w-3xl mx-auto">

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <MapIcon size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Geofencing Setup</h2>
                                <p className="text-sm text-gray-500">Configure the primary office location for attendance geofencing restrictions</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-gray-500">Loading settings...</div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Office Name <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            name="officeName"
                                            value={formData.officeName}
                                            onChange={handleChange}
                                            required
                                            className="w-full form-input bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
                                            placeholder="e.g. Headquarters"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Allowed Radius (Kilometers) <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            name="radiusKm"
                                            value={formData.radiusKm}
                                            onChange={handleChange}
                                            required
                                            min="0.01"
                                            className="w-full form-input bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">Complete Address</label>
                                        <textarea
                                            name="address"
                                            rows="2"
                                            value={formData.address}
                                            onChange={handleChange}
                                            className="w-full form-input bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
                                            placeholder="Office address details"
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="border border-gray-100 rounded-lg bg-gray-50 p-5 mt-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                            <MapPin size={16} className="text-blue-500" />
                                            GPS Coordinates
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            className="flex items-center gap-1.5 text-xs font-medium bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                                        >
                                            <Navigation size={14} /> Detect Current Location
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">Latitude <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="latitude"
                                                value={formData.latitude}
                                                onChange={handleChange}
                                                required
                                                className="w-full form-input"
                                                placeholder="e.g. 19.0760"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">Longitude <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="longitude"
                                                value={formData.longitude}
                                                onChange={handleChange}
                                                required
                                                className="w-full form-input"
                                                placeholder="e.g. 72.8777"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-gray-100">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                                    >
                                        <Save size={16} />
                                        {submitting ? 'Saving...' : 'Save Office Location'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-5">
                        <h4 className="text-sm font-semibold text-blue-800 mb-2">How Geofencing Works</h4>
                        <ul className="text-sm text-blue-700 space-y-1.5 list-disc list-inside">
                            <li>When employees attempt to <strong>Clock In</strong> or <strong>Clock Out</strong>, their GPS location is verified.</li>
                            <li>They will only be permitted to clock in if they are within the declared <strong>Allowed Radius</strong> of the coordinates above.</li>
                            <li>Employees logging in through the "Work From Home" feature ignore these validations if their WFH request was approved.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

# Cannabis Consumption Tracker Pro

## Overview

Cannabis Consumption Tracker Pro is a Progressive Web Application (PWA) designed to help users monitor and analyze their cannabis consumption patterns. The application provides comprehensive tracking capabilities including consumption logs, statistical analysis, cost tracking, and social performance monitoring. Built as a client-side application, it offers offline functionality and data persistence through browser localStorage.

## Recent Changes

### September 2025 - Major UI/UX and Analytics Improvements
- **Responsive Hamburger Menu**: Implemented complete mobile navigation with animated hamburger menu for screens ≤768px, including mobile theme toggle and logout functionality
- **Advanced Recommendations System**: Complete overhaul from basic recommendations to comprehensive analysis including efficiency analysis, provider comparison, consumption method optimization, frequency tracking, side effects analysis, and budget optimization with color-coded visual cards
- **Enhanced Social Performance Module**: Expanded from 3 basic metrics to 6 comprehensive dimensions (social interactions, productivity, mood, sleep quality, stress levels, motivation) using 1-10 numeric scales with intelligent insights, trend analysis, and consumption correlation detection
- **PWA Installation Support**: Added professional cannabis-themed app icons (192x192px, 512x512px) with proper manifest configuration for home screen installation on mobile devices
- **Advanced Data Visualization**: Implemented radar charts for social metrics overview, multi-line trend charts for temporal analysis, and enhanced chart responsiveness across all device sizes
- **Intelligent Analytics**: Added automatic pattern detection, correlation analysis between consumption and wellbeing metrics, and personalized recommendations based on user data trends

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Single Page Application (SPA)**: Built with vanilla HTML, CSS, and JavaScript using a tab-based navigation system
- **Responsive Design**: Mobile-first approach with hamburger menu for mobile devices and full navigation for desktop
- **Theme System**: Dark/light theme toggle with CSS custom properties for consistent theming
- **Progressive Web App**: Includes service worker for offline functionality and app-like installation capabilities

### Data Management
- **Client-Side Storage**: Uses browser localStorage for data persistence, with user-specific data isolation
- **Data Structure**: Maintains separate arrays for consumption records and social performance data
- **Session Management**: Simple username-based authentication stored in localStorage

### User Interface Components
- **Tab Navigation**: Multi-tab interface covering dashboard, data entry, records view, statistics, recommendations, and social performance
- **Data Visualization**: Chart.js integration for rendering consumption statistics, cost analysis, and trend visualizations
- **Form Handling**: Dynamic form validation and user feedback through message systems
- **Responsive Charts**: All charts configured with maintainAspectRatio: false for optimal mobile display

### Key Features Architecture
- **Dashboard**: Central hub with quick statistics and recent activity overview
- **Data Entry**: Form-based system for logging consumption sessions with detailed metadata
- **Statistics Engine**: Real-time calculation of consumption patterns, costs, and trends
- **Recommendations System**: Basic rule-based recommendations based on usage patterns
- **Social Performance Tracking**: Separate module for monitoring social interactions and performance

### State Management
- **Global State**: Centralized state management through global JavaScript variables
- **Event-Driven Updates**: UI updates triggered by user actions and data changes
- **Data Synchronization**: Automatic chart and display updates when underlying data changes

## External Dependencies

### Content Delivery Networks
- **Chart.js**: Data visualization library for rendering consumption statistics and trend charts
- **jsPDF**: PDF generation library for exporting reports and data summaries
- **Google Fonts (Orbitron)**: Custom typography for enhanced visual appeal

### Browser APIs
- **localStorage API**: Primary data persistence mechanism for user records and preferences
- **Service Worker API**: Enables offline functionality and PWA capabilities
- **Responsive Design APIs**: Viewport and media query support for multi-device compatibility

### PWA Infrastructure
- **Web App Manifest**: Defines app metadata, icons, and installation behavior
- **Service Worker**: Handles caching strategy and offline functionality
- **Cache API**: Manages offline resource availability

Note: The application is designed to be fully self-contained with no backend dependencies, making it suitable for deployment on any static hosting platform.
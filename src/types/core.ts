/**
 * Core Type Definitions
 * Main data types for the hospital census application.
 *
 * This file now acts as an aggregator facade, re-exporting modular types
 * from the domain folder to avoid massive file sizes while keeping compatibility.
 */

export * from './domain/base';
export * from './domain/clinical';
export * from './domain/patient';
export * from './domain/movements';
export * from './domain/dailyRecord';
